// Zustand store for dashboard layout — which chart cards exist and how they're configured.
// Persisted to localStorage under the key 'filippo-layout-v1'.
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { PlotConfig, PlotSeries } from '../types'

interface LayoutState {
  // ─── State ──────────────────────────────────────────────────────────────────
  plots: PlotConfig[]

  // ─── Actions ─────────────────────────────────────────────────────────────────
  addPlot: (plot: Omit<PlotConfig, 'id'>) => void
  removePlot: (id: string) => void
  updatePlot: (id: string, updates: Partial<Omit<PlotConfig, 'id'>>) => void

  // Series-level mutations — update one series inside a specific plot.
  addSeries: (plotId: string, series: Omit<PlotSeries, 'id'>) => void
  removeSeries: (plotId: string, seriesId: string) => void
}

export const useLayoutStore = create<LayoutState>()(
  persist(
    (set) => ({
      plots: [],

      addPlot: (plot) => {
        const id = `plot_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
        set(state => ({ plots: [...state.plots, { ...plot, id }] }))
      },

      removePlot: (id) => {
        set(state => ({ plots: state.plots.filter(p => p.id !== id) }))
      },

      updatePlot: (id, updates) => {
        set(state => ({
          plots: state.plots.map(p => p.id === id ? { ...p, ...updates } : p),
        }))
      },

      addSeries: (plotId, series) => {
        const id = `ser_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
        set(state => ({
          plots: state.plots.map(p =>
            p.id === plotId
              ? { ...p, series: [...p.series, { ...series, id }] }
              : p
          ),
        }))
      },

      removeSeries: (plotId, seriesId) => {
        set(state => ({
          plots: state.plots.map(p =>
            p.id === plotId
              ? { ...p, series: p.series.filter(s => s.id !== seriesId) }
              : p
          ),
        }))
      },
    }),
    { name: 'filippo-layout-v1' }
  )
)
