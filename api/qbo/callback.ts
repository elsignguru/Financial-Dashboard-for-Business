// GET — Intuit redirects here after the user approves (or denies) access on
// its hosted consent screen. Deliberately does NO data pulling: just
// exchanges the code, upserts the company + tokens, and redirects back.
// Kept fast so it never risks a serverless timeout during the OAuth chain.
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { supabaseAdmin } from '../_lib/supabaseAdmin'
import { exchangeCodeForTokens, fetchCompanyName, storeTokens } from '../_lib/qboClient'
import { verifyState } from '../_lib/state'

function redirectHome(res: VercelResponse, params: Record<string, string>) {
  const qs = new URLSearchParams(params).toString()
  res.writeHead(302, { Location: `/${qs ? `?${qs}` : ''}` })
  res.end()
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { code, realmId, state, error: qboError } = req.query as Record<string, string | undefined>

  if (qboError) {
    redirectHome(res, { qbo_error: `QuickBooks: ${qboError}` })
    return
  }

  if (!verifyState(state)) {
    redirectHome(res, { qbo_error: 'Solicitud de conexión inválida o expirada. Intenta de nuevo.' })
    return
  }

  if (!code || !realmId) {
    redirectHome(res, { qbo_error: 'QuickBooks no envió los datos esperados.' })
    return
  }

  try {
    const tokens = await exchangeCodeForTokens(code)
    const companyName = await fetchCompanyName(realmId, tokens.access_token)

    const admin = supabaseAdmin()
    const { data: company, error: upsertErr } = await admin
      .from('companies')
      .upsert(
        { qbo_realm_id: realmId, display_name: companyName, status: 'connected', last_sync_error: null },
        { onConflict: 'qbo_realm_id' },
      )
      .select('id')
      .single()

    if (upsertErr || !company) throw new Error(upsertErr?.message || 'No se pudo guardar la empresa')

    await storeTokens(company.id as string, tokens)

    redirectHome(res, { connected: company.id as string })
  } catch (err) {
    redirectHome(res, { qbo_error: err instanceof Error ? err.message : String(err) })
  }
}
