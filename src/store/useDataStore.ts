// Zustand store for company data and metric visibility.
// Persisted to localStorage under the key 'filippo-data-v1'.
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Company, ParsedReport } from '../types'

interface DataState {
  // ─── State ──────────────────────────────────────────────────────────────────
  companies: Company[]
  hiddenMetrics: string[]  // "companyId::metricName"

  // ─── Actions ─────────────────────────────────────────────────────────────────
  addCompany: (report: ParsedReport) => Company
  updateCompanyName: (id: string, name: string) => void
  removeCompany: (id: string) => void
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

      // Assigns a random stable ID and appends the new company.
      addCompany: (report) => {
        const id = `co_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
        const company: Company = { id, name: report.companyName, report }
        set(state => ({ companies: [...state.companies, company] }))
        return company
      },

      // Updates both the top-level display name and the name inside the report.
      updateCompanyName: (id, name) => {
        set(state => ({
          companies: state.companies.map(c =>
            c.id === id ? { ...c, name, report: { ...c.report, companyName: name } } : c
          ),
        }))
      },

      // Removes the company and cleans up any hidden-metric entries that referenced it.
      removeCompany: (id) => {
        set(state => ({
          companies: state.companies.filter(c => c.id !== id),
          hiddenMetrics: state.hiddenMetrics.filter(k => !k.startsWith(`${id}::`)),
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
    { name: 'filippo-data-v1' }
  )
)
