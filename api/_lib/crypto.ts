// AES-256-GCM encrypt/decrypt for OAuth tokens at rest, per Intuit's
// security policy ("Encrypt the refresh token with a symmetric algorithm...
// store your AES key in a separate configuration file" — QBO_TOKEN_ENC_KEY
// lives only in Vercel's env, never alongside the encrypted data in Supabase).
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'

const ALGORITHM = 'aes-256-gcm'

function key(): Buffer {
  const hex = process.env.QBO_TOKEN_ENC_KEY
  if (!hex) throw new Error('Falta QBO_TOKEN_ENC_KEY en las variables de entorno')
  const buf = Buffer.from(hex, 'hex')
  if (buf.length !== 32) {
    throw new Error('QBO_TOKEN_ENC_KEY debe ser una clave hex de 32 bytes (64 caracteres) — genera una con: openssl rand -hex 32')
  }
  return buf
}

// Returns "iv:authTag:ciphertext", all hex-encoded, as a single string
// suitable for a text column.
export function encryptSecret(plaintext: string): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv(ALGORITHM, key(), iv)
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()
  return [iv.toString('hex'), authTag.toString('hex'), ciphertext.toString('hex')].join(':')
}

export function decryptSecret(stored: string): string {
  const [ivHex, tagHex, dataHex] = stored.split(':')
  if (!ivHex || !tagHex || !dataHex) throw new Error('Valor cifrado con formato inválido')
  const decipher = createDecipheriv(ALGORITHM, key(), Buffer.from(ivHex, 'hex'))
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'))
  const plaintext = Buffer.concat([decipher.update(Buffer.from(dataHex, 'hex')), decipher.final()])
  return plaintext.toString('utf8')
}
