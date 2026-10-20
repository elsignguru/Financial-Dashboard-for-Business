// Zustand store for company data and metric visibility.
// `companies` is a Supabase-backed cache populated by loadCompanies() on
// bootstrap — only `hiddenMetrics` (a pure local UI preference) is persisted
// to localStorage under the key 'filippo-data-v1'.
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Company } from '../types'
import { supabase } from '../lib/supabaseClient'
import { disconnectCompany } from '../lib/qboApi'

interface DataState {
  // ─── State ──────────────────────────────────────────────────────────────────
  companies: Company[]
  hiddenMetrics: string[]  // "companyId::metricName"

  // ─── Actions ─────────────────────────────────────────────────────────────────
  // Wholesale-replaces the companies array — called by loadCompanies() after
  // fetching from Supabase.
  setCompanies: (companies: Company[]) => void
  updateCompanyName: (id: string, name: string) => Promise<void>
  removeCompany: (id: string, permanent?: boolean) => Promise<void>
  toggleHideMetric: (companyId: string, metricName: string) => void
  isMetricHidden: (companyId: string, metricName: string) => boolean

  // Returns all unique month strings ("YYYY-MM") across every loaded company, sorted.
  allDates: () => string[]
}

export const useDataStore = create<DataState>()(
  persist(
    (set, get) => ({
      companies: [],
      hiddenMetrics: [],

      setCompanies: (companies) => set({ companies }),

      // Persists the rename to Supabase (companies.display_name is safe for
      // the authenticated role to write — see supabase/schema.sql), then
      // updates local state once that succeeds.
      updateCompanyName: async (id, name) => {
        const { error } = await supabase.from('companies').update({ display_name: name }).eq('id', id)
        if (error) throw new Error(error.message)
        set(state => ({
          companies: state.companies.map(c =>
            c.id === id ? { ...c, name, report: { ...c.report, companyName: name } } : c
          ),
        }))
      },

      // Disconnects the company server-side (service-role — see
      // api/qbo/disconnect.ts). Default is a SOFT disconnect: same id,
      // history kept, only the QuickBooks token is removed — reflected
      // locally by marking it disconnected rather than removing it from the
      // list, since reconnecting reuses the same id and charts referencing
      // it keep working. `permanent: true` fully deletes it instead (e.g.
      // a Sandbox test company you'll never reconnect) — removed locally too.
      removeCompany: async (id, permanent = false) => {
        await disconnectCompany(id, permanent)
        set(state => ({
          companies: permanent
            ? state.companies.filter(c => c.id !== id)
            : state.companies.map(c => c.id === id ? { ...c, qboStatus: 'disconnected' } : c),
          hiddenMetrics: permanent
            ? state.hiddenMetrics.filter(k => !k.startsWith(`${id}::`))
            : state.hiddenMetrics,
        }))
      },

      toggleHideMetric: (companyId, metricName) => {
        const key = `${companyId}::${metricName}`
        set(state => ({
          hiddenMetrics: state.hiddenMetrics.includes(key)
            ? state.hiddenMetrics.filter(k => k !== key)
            : [...state.hiddenMetrics, key],
        }))
      },

      isMetricHidden: (companyId, metricName) => {
        return get().hiddenMetrics.includes(`${companyId}::${metricName}`)
      },

      allDates: () => {
        const all = new Set<string>()
        for (const c of get().companies) {
          c.report.dates.forEach(d => all.add(d))
        }
        return Array.from(all).sort()
      },
    }),
    {
      name: 'filippo-data-v1',
      partialize: (state) => ({ hiddenMetrics: state.hiddenMetrics }),
    }
  )
)
