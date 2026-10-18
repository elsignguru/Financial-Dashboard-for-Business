// Replaces the old CSV UploadZone. Kicks off the "Connect new company" OAuth
// flow, and handles the redirect back from /api/qbo/callback: on `?connected=`
// it fires the one-time full-history backfill via sync-now, then refetches;
// on `?qbo_error=` it just surfaces the message. Per-company status/"Sync now"
// lives in Sidebar.tsx's CompanySection, not here, to avoid a second company list.
import { useEffect, useState } from 'react'
import { getQboConnectUrl, syncCompanyNow } from '../../lib/qboApi'
import { loadCompanies } from '../../data/loadCompanies'

export default function CompaniesPanel() {
  const [connecting, setConnecting] = useState(false)
  const [syncingNew, setSyncingNew] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const connectedId = params.get('connected')
    const qboError = params.get('qbo_error')
    if (!connectedId && !qboError) return

    params.delete('connected')
    params.delete('qbo_error')
    const qs = params.toString()
    window.history.replaceState({}, '', window.location.pathname + (qs ? `?${qs}` : ''))

    // setState calls are nested inside this async function (a callback, not
    // the effect body directly) so they run as a reaction to the async work
    // completing, not synchronously during the effect itself.
    async function handleRedirect() {
      if (connectedId) {
        setSyncingNew(true)
        try {
          await syncCompanyNow(connectedId, true)
        } catch (err) {
          setMessage(err instanceof Error ? err.message : String(err))
        }
        try {
          await loadCompanies()
        } catch (err) {
          setMessage(err instanceof Error ? err.message : String(err))
        }
        setSyncingNew(false)
      } else if (qboError) {
        setMessage(qboError)
      }
    }

    handleRedirect()
  }, [])

  const handleConnect = async () => {
    setConnecting(true)
    setMessage('')
    try {
      window.location.href = await getQboConnectUrl()
    } catch (err) {
      setMessage(err instanceof Error ? err.message : String(err))
      setConnecting(false)
    }
  }

  return (
    <div className="space-y-2">
      {syncingNew && (
        <p className="text-xs text-blue-600 bg-blue-50 border border-blue-200 rounded px-2 py-1.5">
          Sincronizando historial de la nueva empresa…
        </p>
      )}
      {message && (
        <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-2 py-1.5">{message}</p>
      )}
      <button
        onClick={handleConnect}
        disabled={connecting}
        className="w-full text-sm text-blue-600 border border-dashed border-blue-300 rounded-lg py-2 hover:bg-blue-50 disabled:opacity-50"
      >
        {connecting ? 'Conectando…' : '+ Conectar empresa de QuickBooks'}
      </button>
    </div>
  )
}
