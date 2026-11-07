// Zustand store for user-defined derived metrics (A op B op C... formulas).
// Shared globally: synced to/from the singleton `dashboard_config` row in
// Supabase (see src/data/dashboardConfigSync.ts) rather than localStorage,
// so every invited user sees the same derived metrics regardless of device
// or session.
import { create } from 'zustand'
import type { DerivedMetric } from '../types'

// Pre-multi-term rows saved to Supabase as { operandA, operator, operandB }
// (before DerivedMetric gained `base`/`terms`) are converted here so they
// keep resolving and keep working in the editor, without a DB migration —
// `dashboard_config` is a schemaless JSON blob, so old rows just sit there
// in the old shape until the next save rewrites them in the new one.
function normalize(raw: unknown): DerivedMetric {
  const m = raw as Partial<DerivedMetric> & { operandA?: DerivedMetric['base']; operator?: DerivedMetric['terms'][number]['operator']; operandB?: DerivedMetric['base'] }
  if (m.base && m.terms) return m as DerivedMetric
  return {
    id: m.id!,
    name: m.name!,
    base: m.operandA!,
    terms: [{ operator: m.operator!, operand: m.operandB! }],
  }
}

interface MetricState {
  // ─── State ──────────────────────────────────────────────────────────────────
  derivedMetrics: DerivedMetric[]

  // ─── Actions ─────────────────────────────────────────────────────────────────
  setDerivedMetrics: (metrics: DerivedMetric[]) => void
  addDerivedMetric: (metric: Omit<DerivedMetric, 'id'>) => DerivedMetric
  removeDerivedMetric: (id: string) => void
  updateDerivedMetric: (id: string, updates: Partial<Omit<DerivedMetric, 'id'>>) => void
}

export const useMetricStore = create<MetricState>()((set) => ({
  derivedMetrics: [],

  // Wholesale-replaces the list — called by dashboardConfigSync when
  // loading the shared config from Supabase. Normalizes any legacy-shape
  // rows on the way in (see `normalize` above).
  setDerivedMetrics: (derivedMetrics) => set({ derivedMetrics: derivedMetrics.map(normalize) }),

  // Assigns a unique ID and saves the new formula.
  addDerivedMetric: (metric) => {
    const id = `dm_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
    const full: DerivedMetric = { ...metric, id }
    set(state => ({ derivedMetrics: [...state.derivedMetrics, full] }))
    return full
  },

  removeDerivedMetric: (id) => {
    set(state => ({ derivedMetrics: state.derivedMetrics.filter(m => m.id !== id) }))
  },

  updateDerivedMetric: (id, updates) => {
    set(state => ({
      derivedMetrics: state.derivedMetrics.map(m => m.id === id ? { ...m, ...updates } : m),
    }))
  },
}))
