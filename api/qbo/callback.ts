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

  if (!/^\d+$/.test(realmId)) {
    redirectHome(res, { qbo_error: 'QuickBooks envió un identificador de empresa inválido.' })
    return
  }

  try {
    const tokens = await exchangeCodeForTokens(code)
    const admin = supabaseAdmin()

    // Look up by realm id first rather than a blind upsert, so reconnecting
    // an already-known company never clobbers a display_name you've
    // customized — the QuickBooks name is only used for brand-new companies.
    const { data: existing, error: lookupErr } = await admin
      .from('companies').select('id').eq('qbo_realm_id', realmId).maybeSingle()
    if (lookupErr) throw new Error(lookupErr.message)

    let companyId: string
    if (existing) {
      companyId = existing.id as string
      const { error: updateErr } = await admin
        .from('companies')
        .update({ status: 'connected', last_sync_error: null })
        .eq('id', companyId)
      if (updateErr) throw new Error(updateErr.message)
    } else {
      const companyName = await fetchCompanyName(realmId, tokens.access_token)
      const { data: inserted, error: insertErr } = await admin
        .from('companies')
        .insert({ qbo_realm_id: realmId, display_name: companyName })
        .select('id')
        .single()
      if (insertErr || !inserted) throw new Error(insertErr?.message || 'No se pudo guardar la empresa')
      companyId = inserted.id as string
    }

    await storeTokens(companyId, tokens)

    redirectHome(res, { connected: companyId })
  } catch (err) {
    redirectHome(res, { qbo_error: err instanceof Error ? err.message : String(err) })
  }
}
