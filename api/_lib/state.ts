// HMAC-signs/verifies the OAuth `state` param sent to Intuit, so our callback
// can prove a given /api/qbo/callback hit corresponds to a connect flow we
// actually initiated (and that it's not stale), without a DB round trip.
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'

const MAX_AGE_MS = 10 * 60 * 1000 // 10 minutes — plenty of time to complete Intuit's consent screen

function secret() {
  const s = process.env.QBO_STATE_SECRET
  if (!s) throw new Error('Falta QBO_STATE_SECRET en las variables de entorno')
  return s
}

export function signState(): string {
  const nonce = randomBytes(16).toString('hex')
  const issuedAt = Date.now().toString()
  const payload = `${nonce}.${issuedAt}`
  const sig = createHmac('sha256', secret()).update(payload).digest('hex')
  return `${payload}.${sig}`
}

export function verifyState(state: string | undefined): boolean {
  if (!state) return false
  const parts = state.split('.')
  if (parts.length !== 3) return false
  const [nonce, issuedAt, sig] = parts

  const payload = `${nonce}.${issuedAt}`
  const expectedSig = createHmac('sha256', secret()).update(payload).digest('hex')

  const sigBuf = Buffer.from(sig, 'hex')
  const expectedBuf = Buffer.from(expectedSig, 'hex')
  if (sigBuf.length !== expectedBuf.length || !timingSafeEqual(sigBuf, expectedBuf)) return false

  const age = Date.now() - Number(issuedAt)
  return age >= 0 && age <= MAX_AGE_MS
}
