// Zustand store for dashboard layout — which chart cards exist and how
// they're configured. Shared globally: synced to/from the singleton
// `dashboard_config` row in Supabase (see src/data/dashboardConfigSync.ts)
// rather than localStorage, so every invited user sees the same charts
// regardless of device or session — same pattern as the TempSense dashboard.
import { create } from 'zustand'
import type { PlotConfig, PlotSeries } from '../types'

interface LayoutState {
  // ─── State ──────────────────────────────────────────────────────────────────
  plots: PlotConfig[]

  // ─── Actions ─────────────────────────────────────────────────────────────────
  setPlots: (plots: PlotConfig[]) => void
  addPlot: (plot: Omit<PlotConfig, 'id'>) => void
  removePlot: (id: string) => void
  updatePlot: (id: string, updates: Partial<Omit<PlotConfig, 'id'>>) => void

  // Series-level mutations — update one series inside a specific plot.
  addSeries: (plotId: string, series: Omit<PlotSeries, 'id'>) => void
  removeSeries: (plotId: string, seriesId: string) => void
}

export const useLayoutStore = create<LayoutState>()((set) => ({
  plots: [],

  // Wholesale-replaces the plot list — called by dashboardConfigSync when
  // loading the shared config from Supabase.
  setPlots: (plots) => set({ plots }),

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
}))
