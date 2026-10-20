// POST, authenticated — syncs ONE company on demand. Used both by the
// "Sync now" button in the UI and, with fullHistory:true, automatically by
// the frontend right after a company is first connected (the one-time
// historical backfill — kept out of callback.ts to avoid any timeout risk
// during the OAuth redirect chain).
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { requireUser } from '../_lib/auth.js'
import { syncCompany } from '../_lib/qboClient.js'

export const config = { maxDuration: 60 }

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

  const { companyId, fullHistory } = req.body as { companyId?: string; fullHistory?: boolean }
  if (!companyId) {
    res.status(400).json({ error: 'Falta companyId' })
    return
  }

  try {
    await syncCompany(companyId, { fullHistory: !!fullHistory })
    res.status(200).json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) })
  }
}
