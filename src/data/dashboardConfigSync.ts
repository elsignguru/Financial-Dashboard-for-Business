// Keeps useLayoutStore's plots and useMetricStore's derivedMetrics in sync
// with the singleton `dashboard_config` row in Supabase, so every invited
// user sees the same dashboard regardless of device or session — same
// pattern as the TempSense dashboard's own dashboard_config table.
import { supabase } from '../lib/supabaseClient'
import { useLayoutStore } from '../store/useLayoutStore'
import { useMetricStore } from '../store/useMetricStore'
import type { PlotConfig, DerivedMetric } from '../types'

const DEBOUNCE_MS = 1000

let saveTimer: ReturnType<typeof setTimeout> | null = null
// Guards against the remote->local load itself triggering a write straight back.
let applyingRemote = false

// Fetches the shared row and populates both stores. Call once on bootstrap,
// after the user is authenticated (RLS requires a session to read it).
export async function loadDashboardConfig(): Promise<void> {
  const { data, error } = await supabase.from('dashboard_config').select('*').eq('id', 1).maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) return // nothing saved yet — stores stay at their empty defaults

  applyingRemote = true
  useLayoutStore.getState().setPlots((data.plots as PlotConfig[]) ?? [])
  useMetricStore.getState().setDerivedMetrics((data.derived_metrics as DerivedMetric[]) ?? [])
  applyingRemote = false
}

function scheduleSave() {
  if (applyingRemote) return
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    const plots = useLayoutStore.getState().plots
    const derived_metrics = useMetricStore.getState().derivedMetrics
    supabase.from('dashboard_config').upsert({ id: 1, plots, derived_metrics })
      .then(({ error }) => { if (error) console.error('No se pudo guardar el dashboard:', error.message) })
  }, DEBOUNCE_MS)
}

let subscribed = false

// Starts watching both stores and writing any change back to Supabase
// (debounced ~1s). Call once on bootstrap, after the first loadDashboardConfig().
export function startDashboardConfigSync(): void {
  if (subscribed) return
  subscribed = true
  useLayoutStore.subscribe(scheduleSave)
  useMetricStore.subscribe(scheduleSave)
}
