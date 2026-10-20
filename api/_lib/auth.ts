// Verifies a Supabase user session from an Authorization: Bearer <access_token>
// header. Used by every endpoint the frontend calls directly (connect-url,
// sync-now) so only invited, logged-in users can trigger them.
import { supabaseAdmin } from './supabaseAdmin.js'

export async function requireUser(authorizationHeader: string | undefined) {
  const token = authorizationHeader?.match(/^Bearer\s+(.+)$/i)?.[1]
  if (!token) throw new Error('Falta el encabezado Authorization')

  const { data, error } = await supabaseAdmin().auth.getUser(token)
  if (error || !data.user) throw new Error('Sesión inválida o expirada')

  return data.user
}
