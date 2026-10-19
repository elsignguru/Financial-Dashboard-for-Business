// QuickBooks Online OAuth2 + Reports API client, plus the single shared
// per-company sync implementation used by both the cron job (sync.ts) and
// the on-demand endpoint (sync-now.ts).
//
// READ-ONLY BY DESIGN: Intuit does not offer a read-only OAuth scope for the
// Accounting API — the `com.intuit.quickbooks.accounting` scope we request
// is the same one write-capable apps use. The read-only guarantee here is
// enforced entirely by this file: `qboGet()` below is the ONLY function that
// talks to the Accounting API (`/v3/company/...`), and it is hardcoded to
// GET. Do not add a POST/PUT/DELETE call to that API anywhere in this
// codebase without explicit sign-off — this app must never be able to
// create, update, or delete anything in a connected QuickBooks company.
import { supabaseAdmin } from './supabaseAdmin'
import { transformProfitAndLoss } from './qboTransform'

const TOKEN_ENDPOINT = 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer'
const AUTHORIZE_ENDPOINT = 'https://appcenter.intuit.com/connect/oauth2'

interface TokenResponse {
  access_token: string
  refresh_token: string
  expires_in: number // seconds, access token (~1hr)
  x_refresh_token_expires_in: number // seconds, refresh token (~100 days)
}

function env(name: string): string {
  const v = process.env[name]
  if (!v) throw new Error(`Falta ${name} en las variables de entorno`)
  return v
}

function apiBase(): string {
  return env('QBO_ENVIRONMENT') === 'production'
    ? 'https://quickbooks.api.intuit.com'
    : 'https://sandbox-quickbooks.api.intuit.com'
}

function basicAuthHeader(): string {
  const id = env('QBO_CLIENT_ID')
  const secret = env('QBO_CLIENT_SECRET')
  return 'Basic ' + Buffer.from(`${id}:${secret}`).toString('base64')
}

export function buildAuthorizationUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: env('QBO_CLIENT_ID'),
    response_type: 'code',
    scope: 'com.intuit.quickbooks.accounting',
    redirect_uri: env('QBO_REDIRECT_URI'),
    state,
  })
  return `${AUTHORIZE_ENDPOINT}?${params.toString()}`
}

async function requestToken(body: URLSearchParams): Promise<TokenResponse> {
  const res = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: basicAuthHeader(),
      Accept: 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  })
  if (!res.ok) {
    throw new Error(`QuickBooks token request failed (${res.status}): ${await res.text()}`)
  }
  return res.json() as Promise<TokenResponse>
}

export function exchangeCodeForTokens(code: string): Promise<TokenResponse> {
  return requestToken(new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: env('QBO_REDIRECT_URI'),
  }))
}

export function refreshTokens(refreshToken: string): Promise<TokenResponse> {
  return requestToken(new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
  }))
}

// The only function in this codebase that calls the QBO Accounting API.
// `method: 'GET'` is explicit (not relying on fetch's default) — see the
// read-only note at the top of this file before ever changing it.
async function qboGet(realmId: string, accessToken: string, path: string): Promise<unknown> {
  const url = `${apiBase()}/v3/company/${realmId}/${path}${path.includes('?') ? '&' : '?'}minorversion=65`
  const res = await fetch(url, {
    method: 'GET',
    headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
  })
  if (!res.ok) {
    throw new Error(`QuickBooks API request failed (${res.status}) for ${path}: ${await res.text()}`)
  }
  return res.json()
}

export async function fetchCompanyName(realmId: string, accessToken: string): Promise<string> {
  const data = await qboGet(realmId, accessToken, `companyinfo/${realmId}`) as {
    CompanyInfo?: { CompanyName?: string }
  }
  return data.CompanyInfo?.CompanyName || `QuickBooks ${realmId}`
}

async function fetchProfitAndLoss(realmId: string, accessToken: string, startDate: string, endDate: string) {
  const params = `reports/ProfitAndLoss?start_date=${startDate}&end_date=${endDate}&summarize_column_by=Month`
  return qboGet(realmId, accessToken, params)
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

// Persists newly-issued tokens. QBO ROTATES the refresh token on every use —
// failing to store the new one here invalidates the connection within one cycle.
export async function storeTokens(companyId: string, tokens: TokenResponse) {
  const now = Date.now()
  const { error } = await supabaseAdmin().from('qbo_tokens').upsert({
    company_id: companyId,
    access_token: tokens.access_token,
    access_token_expires_at: new Date(now + tokens.expires_in * 1000).toISOString(),
    refresh_token: tokens.refresh_token,
    refresh_token_expires_at: new Date(now + tokens.x_refresh_token_expires_in * 1000).toISOString(),
    updated_at: new Date(now).toISOString(),
  })
  if (error) throw new Error(`No se pudo guardar el token de QuickBooks: ${error.message}`)
}

// Returns a valid access token for the company, refreshing (and persisting
// the rotated refresh token) if the current one is within 5 minutes of expiry.
async function getValidAccessToken(companyId: string): Promise<{ accessToken: string; realmId: string }> {
  const admin = supabaseAdmin()

  const { data: company, error: companyErr } = await admin
    .from('companies').select('qbo_realm_id').eq('id', companyId).single()
  if (companyErr || !company) throw new Error(`Empresa no encontrada: ${companyId}`)

  const { data: tokenRow, error: tokenErr } = await admin
    .from('qbo_tokens').select('*').eq('company_id', companyId).single()
  if (tokenErr || !tokenRow) throw new Error(`No hay conexión de QuickBooks para esta empresa`)

  const expiresAt = new Date(tokenRow.access_token_expires_at as string).getTime()
  const safetyMarginMs = 5 * 60 * 1000
  if (Date.now() < expiresAt - safetyMarginMs) {
    return { accessToken: tokenRow.access_token as string, realmId: company.qbo_realm_id as string }
  }

  const refreshed = await refreshTokens(tokenRow.refresh_token as string)
  await storeTokens(companyId, refreshed)
  return { accessToken: refreshed.access_token, realmId: company.qbo_realm_id as string }
}

// Shared sync implementation for one company. `fullHistory` is used once,
// right after connecting; every later sync (cron or "Sync now") uses the
// trailing 18-month rolling window so prior-period adjusting entries are
// re-pulled without re-fetching years of static data every run.
export async function syncCompany(companyId: string, opts: { fullHistory?: boolean } = {}): Promise<void> {
  const admin = supabaseAdmin()

  try {
    const { accessToken, realmId } = await getValidAccessToken(companyId)

    const end = new Date()
    const start = new Date(end)
    if (opts.fullHistory) {
      start.setFullYear(2015, 0, 1) // QBO simply returns no rows before real data starts
    } else {
      start.setMonth(start.getMonth() - 18)
    }

    const report = await fetchProfitAndLoss(realmId, accessToken, isoDate(start), isoDate(end))
    const rows = transformProfitAndLoss(report as Parameters<typeof transformProfitAndLoss>[0])

    if (rows.length > 0) {
      const { error: upsertErr } = await admin.from('pnl_line_items').upsert(
        rows.map(r => ({
          company_id: companyId,
          section: r.section,
          metric_name: r.metricName,
          row_type: r.rowType,
          period: r.period,
          value: r.value,
          sort_order: r.sortOrder,
          synced_at: new Date().toISOString(),
        })),
        { onConflict: 'company_id,section,metric_name,period' },
      )
      if (upsertErr) throw new Error(`No se pudo guardar el P&L: ${upsertErr.message}`)
    }

    await admin.from('companies').update({
      status: 'connected',
      last_synced_at: new Date().toISOString(),
      last_sync_error: null,
    }).eq('id', companyId)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    await admin.from('companies').update({
      status: 'error',
      last_sync_error: message,
    }).eq('id', companyId)
    throw err
  }
}
