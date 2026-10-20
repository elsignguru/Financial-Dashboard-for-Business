// Zustand store for user-defined derived metrics (A op B formulas). Shared
// globally: synced to/from the singleton `dashboard_config` row in Supabase
// (see src/data/dashboardConfigSync.ts) rather than localStorage, so every
// invited user sees the same derived metrics regardless of device or session.
import { create } from 'zustand'
import type { DerivedMetric } from '../types'

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
  // loading the shared config from Supabase.
  setDerivedMetrics: (derivedMetrics) => set({ derivedMetrics }),

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
