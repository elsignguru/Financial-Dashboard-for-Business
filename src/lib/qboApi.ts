// Thin client for the authenticated /api/qbo/* serverless endpoints —
// attaches the current Supabase access token as a Bearer header.
import { supabase } from './supabaseClient'

async function authedFetch(path: string, body?: unknown): Promise<unknown> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('No hay sesión activa')

  const res = await fetch(path, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })

  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error((json as { error?: string }).error || `Error (${res.status})`)
  return json
}

export async function getQboConnectUrl(): Promise<string> {
  const json = await authedFetch('/api/qbo/connect-url') as { url: string }
  return json.url
}

export function syncCompanyNow(companyId: string, fullHistory = false): Promise<unknown> {
  return authedFetch('/api/qbo/sync-now', { companyId, fullHistory })
}

// `permanent: true` fully deletes the company and its synced history
// instead of the default soft-disconnect (keeps the row so reconnecting
// doesn't orphan existing charts).
export function disconnectCompany(companyId: string, permanent = false): Promise<unknown> {
  return authedFetch('/api/qbo/disconnect', { companyId, permanent })
}
