// Single shared Supabase client — every data-fetching module imports from here
// so there is only one connection/session instance in the app.
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Faltan VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY en las variables de entorno')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
