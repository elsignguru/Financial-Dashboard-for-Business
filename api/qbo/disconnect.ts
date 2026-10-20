// POST, authenticated — disconnects a company. This is a SOFT disconnect:
// the companies row (and its id, and its synced pnl_line_items history) is
// kept — only qbo_tokens is removed and status flips to 'disconnected'.
// Keeping the same id means any chart/derived-metric referencing this
// company keeps working once it's reconnected, instead of silently going
// blank because a hard delete + re-insert would have given it a new id.
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { requireUser } from '../_lib/auth.js'
import { supabaseAdmin } from '../_lib/supabaseAdmin.js'
import { noStore } from '../_lib/http.js'
import { revokeToken } from '../_lib/qboClient.js'
import { decryptSecret } from '../_lib/crypto.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  noStore(res)
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  try {
    await requireUser(req.headers.authorization)
  } catch (err) {
    res.status(401).json({ error: err instanceof Error ? err.message : String(err) })
    return
  }

  const { companyId } = req.body as { companyId?: string }
  if (!companyId) {
    res.status(400).json({ error: 'Falta companyId' })
    return
  }

  const admin = supabaseAdmin()

  // Tell Intuit the grant is over before we delete our copy of the tokens —
  // best-effort, a revoke failure shouldn't block disconnecting locally.
  const { data: tokenRow } = await admin.from('qbo_tokens').select('refresh_token').eq('company_id', companyId).maybeSingle()
  if (tokenRow) {
    try {
      await revokeToken(decryptSecret(tokenRow.refresh_token))
    } catch {
      // Ignored — the token row is deleted below regardless, so even if
      // Intuit's revoke call failed, this app can no longer use it.
    }
  }

  const { error: tokenDeleteErr } = await admin.from('qbo_tokens').delete().eq('company_id', companyId)
  if (tokenDeleteErr) {
    res.status(500).json({ error: tokenDeleteErr.message })
    return
  }

  const { error: statusErr } = await admin.from('companies').update({ status: 'disconnected' }).eq('id', companyId)
  if (statusErr) {
    res.status(500).json({ error: statusErr.message })
    return
  }

  res.status(200).json({ ok: true })
}
