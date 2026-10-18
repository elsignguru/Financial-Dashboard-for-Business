// Email/password sign-in form. There is no public signup — users are invited
// by being created manually in the Supabase Auth dashboard.
import { useState, type FormEvent } from 'react'
import { supabase } from '../../lib/supabaseClient'

export default function LoginForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { error: authError } = await supabase.auth.signInWithPassword({ email, password })

    if (authError) {
      setError(authError.message)
      setLoading(false)
    }
    // On success, the AuthGate's onAuthStateChange listener picks up the new
    // session and swaps this form out automatically.
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-80 bg-white border border-gray-200 rounded-lg p-8 space-y-5">
        <div>
          <h1 className="text-base font-bold text-gray-900">Grupo Filippo</h1>
          <p className="text-xs text-gray-400 mt-0.5">Dashboard Financiero</p>
        </div>

        <hr className="border-gray-200" />

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs text-gray-500">Correo</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="tu@empresa.com"
              required
              autoFocus
              className="w-full text-sm border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs text-gray-500">Contraseña</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              className="w-full text-sm border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {error && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full text-sm font-medium bg-blue-600 text-white rounded px-4 py-2 hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Ingresando…' : 'Ingresar'}
          </button>
        </form>
      </div>
    </div>
  )
}
