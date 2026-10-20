// POST, authenticated — disconnects a company. By default this is a SOFT
// disconnect: the companies row (and its id, and its synced pnl_line_items
// history) is kept — only qbo_tokens is removed and status flips to
// 'disconnected'. Keeping the same id means any chart/derived-metric
// referencing this company keeps working once it's reconnected, instead of
// silently going blank because a hard delete + re-insert would have given
// it a new id. Pass `permanent: true` to fully remove the company and its
// history instead — for a company (e.g. a Sandbox test one) that will
// never be reconnected and whose data you want gone, not just paused.
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

  const { companyId, permanent } = req.body as { companyId?: string; permanent?: boolean }
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

  if (permanent) {
    // Cascades to pnl_line_items via the FK — fully removes the company and
    // all its synced history, not just the live connection.
    const { error: deleteErr } = await admin.from('companies').delete().eq('id', companyId)
    if (deleteErr) {
      res.status(500).json({ error: deleteErr.message })
      return
    }
    res.status(200).json({ ok: true, permanent: true })
    return
  }

  const { error: statusErr } = await admin.from('companies').update({ status: 'disconnected' }).eq('id', companyId)
  if (statusErr) {
    res.status(500).json({ error: statusErr.message })
    return
  }

  res.status(200).json({ ok: true })
}
