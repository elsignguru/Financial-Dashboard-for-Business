// Zustand store for user-defined derived metrics (A op B formulas).
// Persisted to localStorage under the key 'filippo-metrics-v1'.
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { DerivedMetric } from '../types'

interface MetricState {
  // ─── State ──────────────────────────────────────────────────────────────────
  derivedMetrics: DerivedMetric[]

  // ─── Actions ─────────────────────────────────────────────────────────────────
  addDerivedMetric: (metric: Omit<DerivedMetric, 'id'>) => DerivedMetric
  removeDerivedMetric: (id: string) => void
  updateDerivedMetric: (id: string, updates: Partial<Omit<DerivedMetric, 'id'>>) => void
}

export const useMetricStore = create<MetricState>()(
  persist(
    (set) => ({
      derivedMetrics: [],

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
    }),
    { name: 'filippo-metrics-v1' }
  )
)
