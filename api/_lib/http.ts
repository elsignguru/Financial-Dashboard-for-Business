import type { VercelResponse } from '@vercel/node'

// Required by Intuit's security policy: pages/endpoints handling sensitive
// data must send an explicit no-cache, no-store Cache-Control header rather
// than relying on platform defaults.
export function noStore(res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-cache, no-store')
}
