// GET, cron-protected — syncs every connected company on the trailing
// 18-month rolling window. Triggered daily by Vercel Cron (see vercel.json).
// Each company's failure is caught individually so one bad connection never
// blocks the rest; syncCompany() itself records the error on that company row.
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { supabaseAdmin } from '../_lib/supabaseAdmin'
import { syncCompany } from '../_lib/qboClient'

export const config = { maxDuration: 300 }

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const expected = `Bearer ${process.env.CRON_SECRET ?? ''}`
  if (!process.env.CRON_SECRET || req.headers.authorization !== expected) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

  const { data: companies, error } = await supabaseAdmin()
    .from('companies')
    .select('id')
    .in('status', ['connected', 'error'])

  if (error) {
    res.status(500).json({ error: error.message })
    return
  }

  const results = await Promise.allSettled(
    (companies ?? []).map(c => syncCompany(c.id as string)),
  )

  const failed = results.filter(r => r.status === 'rejected').length
  res.status(200).json({ synced: results.length - failed, failed })
}
