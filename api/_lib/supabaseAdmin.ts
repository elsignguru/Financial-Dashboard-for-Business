// Service-role Supabase client — server-only. Bypasses RLS entirely, so this
// must never be imported from anything that ships to the browser; it only
// ever runs inside api/**.
import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types.js'

let client: ReturnType<typeof createClient<Database>> | null = null

export function supabaseAdmin() {
  if (client) return client

  const url = process.env.SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceRoleKey) {
    throw new Error('Faltan SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY en las variables de entorno')
  }

  client = createClient<Database>(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  return client
}
