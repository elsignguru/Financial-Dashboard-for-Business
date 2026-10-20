// POST, authenticated — returns a signed Intuit authorization URL. The
// Supabase access token travels in the Authorization header (never a query
// string) so it never lands in server logs or browser history; the browser
// then navigates directly to the returned Intuit URL.
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { requireUser } from '../_lib/auth.js'
import { buildAuthorizationUrl } from '../_lib/qboClient.js'
import { signState } from '../_lib/state.js'
import { noStore } from '../_lib/http.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  noStore(res)
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  try {
    await requireUser(req.headers.authorization)
    const url = buildAuthorizationUrl(signState())
    res.status(200).json({ url })
  } catch (err) {
    res.status(401).json({ error: err instanceof Error ? err.message : String(err) })
  }
}
