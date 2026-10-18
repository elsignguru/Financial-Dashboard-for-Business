// Gates the whole dashboard behind a Supabase session. Same pattern as the
// TempSense dashboard (app/page.js + components/LoginForm.jsx): check for an
// existing session on mount, subscribe to sign-out, render LoginForm until
// authenticated. No router needed here since this SPA has none.
import { useEffect, useState, type ReactNode } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { loadCompanies } from '../../data/loadCompanies'
import LoginForm from './LoginForm'

export default function AuthGate({ children }: { children: ReactNode }) {
  const [checking, setChecking] = useState(true)
  const [authed, setAuthed] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setAuthed(!!session)
      setChecking(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthed(!!session)
    })

    return () => subscription.unsubscribe()
  }, [])

  // Fetch companies/P&L data from Supabase once a session is confirmed.
  useEffect(() => {
    if (authed) loadCompanies().catch(err => console.error('No se pudieron cargar las empresas:', err))
  }, [authed])

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-gray-400">
        Verificando sesión…
      </div>
    )
  }

  if (!authed) return <LoginForm />

  return <>{children}</>
}
