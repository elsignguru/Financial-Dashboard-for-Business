// POST, authenticated — removes a connected company. Goes through the
// service-role client (not a client-side delete policy) because the cascade
// delete into qbo_tokens would otherwise be blocked by that table's RLS,
// which intentionally has zero policies for the authenticated role.
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { requireUser } from '../_lib/auth'
import { supabaseAdmin } from '../_lib/supabaseAdmin'

export default async function handler(req: VercelRequest, res: VercelResponse) {
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

  const { error } = await supabaseAdmin().from('companies').delete().eq('id', companyId)
  if (error) {
    res.status(500).json({ error: error.message })
    return
  }

  res.status(200).json({ ok: true })
}
