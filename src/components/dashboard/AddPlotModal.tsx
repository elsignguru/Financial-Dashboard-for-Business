// Modal for creating or editing a chart (PlotConfig).
// Manages a local SeriesForm list that is converted to PlotSeries[] on submit.
import { useState } from 'react'
import Modal from '../ui/Modal'
import MetricSelector from '../metrics/MetricSelector'
import { useDataStore } from '../../store/useDataStore'
import { useMetricStore } from '../../store/useMetricStore'
import { useLayoutStore } from '../../store/useLayoutStore'
import type { ChartType, MetricRef, PlotSeries } from '../../types'
import { formatDateFull } from '../../utils/dateUtils'

// ─── SeriesForm ─────────────────────────────────────────────────────────────────
// Local form state for one data series — richer than PlotSeries so the UI can
// hold intermediate values (e.g. partially selected companies in combined mode)
// before they're validated and converted to a MetricRef on submit.
interface SeriesForm {
  tempId: string
  label: string
  mode: 'raw' | 'combined' | 'derived'
  companyId: string
  metricName: string
  combinedCompanyIds: string[]
  combinedMetricName: string
  combinedCompanyMetricName: string
  derivedMetricId: string
}

function newSeries(defaultCompanyId: string): SeriesForm {
  return {
    tempId: `tmp_${Date.now()}`,
    label: '',
    mode: 'raw',
    companyId: defaultCompanyId,
    metricName: '',
    combinedCompanyIds: [],
    combinedMetricName: '',
    combinedCompanyMetricName: '',
    derivedMetricId: '',
  }
}

interface Props {
  open: boolean
  onClose: () => void
  editingPlotId?: string  // When provided, the modal loads and updates an existing plot.
}

export default function AddPlotModal({ open, onClose, editingPlotId }: Props) {
  const companies = useDataStore(s => s.companies)
  const allDates = useDataStore(s => s.allDates)
  const derivedMetrics = useMetricStore(s => s.derivedMetrics)
  const addPlot = useLayoutStore(s => s.addPlot)
  const updatePlot = useLayoutStore(s => s.updatePlot)
  const plots = useLayoutStore(s => s.plots)

  const editing = editingPlotId ? plots.find(p => p.id === editingPlotId) : undefined

  // ─── Form defaults ────────────────────────────────────────────────────────────
  const dates = allDates()
  const defaultStart = dates.length >= 13 ? dates[dates.length - 13] : dates[0] ?? ''
  const defaultEnd = dates[dates.length - 1] ?? ''

  const [title, setTitle] = useState(editing?.title ?? '')
  const [chartType, setChartType] = useState<ChartType>(editing?.chartType ?? 'line')
  const [periodStart, setPeriodStart] = useState(editing?.periodStart ?? defaultStart)
  const [periodEnd, setPeriodEnd] = useState(editing?.periodEnd ?? defaultEnd)
  const [seriesList, setSeriesList] = useState<SeriesForm[]>(
    editing ? editing.series.map(s => seriesFromConfig(s, companies)) : [newSeries(companies[0]?.id ?? '')]
  )
  const [error, setError] = useState('')

  // ─── SeriesForm → MetricRef conversion ───────────────────────────────────────
  // Returns null if the form is incomplete (validation happens in handleSubmit).
  function seriesFormToRef(s: SeriesForm): MetricRef | null {
    if (s.mode === 'raw') {
      if (!s.companyId || !s.metricName) return null
      return { type: 'raw', companyId: s.companyId, metricName: s.metricName }
    }
    if (s.mode === 'combined') {
      if (!s.combinedCompanyIds.length || !s.combinedMetricName) return null
      return { type: 'combined', metricName: s.combinedMetricName, companyIds: s.combinedCompanyIds }
    }
    if (s.mode === 'derived') {
      if (!s.derivedMetricId) return null
      return { type: 'derived', derivedMetricId: s.derivedMetricId }
    }
    return null
  }

  // ─── Submit ───────────────────────────────────────────────────────────────────
  function handleSubmit() {
    if (!periodStart || !periodEnd) { setError('Selecciona el período'); return }
    if (periodStart > periodEnd) { setError('La fecha inicio debe ser anterior al fin'); return }
    if (!seriesList.length) { setError('Agrega al menos una serie'); return }

    const series: PlotSeries[] = []
    for (const s of seriesList) {
      const ref = seriesFormToRef(s)
      if (!ref) { setError(`Serie "${s.label || '(sin nombre)'}" incompleta`); return }
      series.push({ id: `ser_${Date.now()}_${Math.random().toString(36).slice(2)}`, label: s.label || autoLabel(s), ref })
    }

    if (editing) {
      updatePlot(editing.id, { title: title || autoTitle(seriesList), chartType, periodStart, periodEnd, series })
    } else {
      addPlot({ title: title || autoTitle(seriesList), chartType, periodStart, periodEnd, series })
    }
    onClose()
  }

  // ─── Auto-label helpers ───────────────────────────────────────────────────────
  // Generate a label for a series or a title for the whole plot when the user leaves them blank.
  function autoLabel(s: SeriesForm): string {
    if (s.mode === 'raw') {
      const co = companies.find(c => c.id === s.companyId)
      return co ? `${s.metricName} — ${co.name}` : s.metricName
    }
    if (s.mode === 'combined') return `${s.combinedMetricName} (combinado)`
    if (s.mode === 'derived') return derivedMetrics.find(d => d.id === s.derivedMetricId)?.name ?? 'Métrica derivada'
    return 'Serie'
  }

  function autoTitle(list: SeriesForm[]): string {
    if (list.length === 1) return autoLabel(list[0])
    return 'Gráfico'
  }

  // ─── Series list mutations ────────────────────────────────────────────────────
  function updateSeries(tempId: string, patch: Partial<SeriesForm>) {
    setSeriesList(prev => prev.map(s => s.tempId === tempId ? { ...s, ...patch } : s))
  }

  function toggleCombinedCompany(seriesTempId: string, companyId: string) {
    setSeriesList(prev => prev.map(s => {
      if (s.tempId !== seriesTempId) return s
      const ids = s.combinedCompanyIds.includes(companyId)
        ? s.combinedCompanyIds.filter(id => id !== companyId)
        : [...s.combinedCompanyIds, companyId]
      return { ...s, combinedCompanyIds: ids }
    }))
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? 'Editar gráfico' : 'Nuevo gráfico'}
      width="max-w-2xl"
    >
      <div className="space-y-5">
        {/* Title & chart type */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Título (opcional)</label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Auto-generado"
              className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Tipo de gráfico</label>
            <div className="flex gap-2">
              {(['line', 'bar', 'pie'] as ChartType[]).map(t => (
                <button
                  key={t}
                  onClick={() => setChartType(t)}
                  className={`flex-1 py-1.5 text-sm rounded border transition-colors ${
                    chartType === t
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'border-gray-300 text-gray-600 hover:border-gray-400'
                  }`}
                >
                  {t === 'line' ? 'Línea' : t === 'bar' ? 'Barras' : 'Torta'}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Date range selection */}
        <div>
          <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Período</label>
          <div className="flex gap-2 items-center">
            <select
              value={periodStart}
              onChange={e => setPeriodStart(e.target.value)}
              className="flex-1 border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {dates.map(d => <option key={d} value={d}>{formatDateFull(d)}</option>)}
            </select>
            <span className="text-gray-400 text-sm">→</span>
            <select
              value={periodEnd}
              onChange={e => setPeriodEnd(e.target.value)}
              className="flex-1 border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {dates.map(d => <option key={d} value={d}>{formatDateFull(d)}</option>)}
            </select>
          </div>
        </div>

        {/* Series list — each series is its own collapsible card */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Series de datos</label>
            <button
              onClick={() => {
                // Cycle through available companies so each new series defaults to a different company.
                const nextIdx = seriesList.length % companies.length
                setSeriesList(prev => [...prev, newSeries(companies[nextIdx]?.id ?? companies[0]?.id ?? '')])
              }}
              className="text-xs text-blue-600 hover:text-blue-800 font-medium"
            >
              + Agregar serie
            </button>
          </div>

          <div className="space-y-4">
            {seriesList.map((s, idx) => (
              <div key={s.tempId} className="border border-gray-200 rounded-lg p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-gray-500">
                    Serie {idx + 1}
                    {s.mode === 'raw' && (() => {
                      const co = companies.find(c => c.id === (s.companyId || companies[0]?.id))
                      return co ? (
                        <>
                          <span className="ml-1 text-blue-500">· {co.name}</span>
                          {s.metricName && <span className="ml-1 text-gray-400">· {s.metricName}</span>}
                        </>
                      ) : null
                    })()}
                  </span>
                  {seriesList.length > 1 && (
                    <button
                      onClick={() => setSeriesList(prev => prev.filter(x => x.tempId !== s.tempId))}
                      className="text-xs text-red-500 hover:text-red-700"
                    >
                      Eliminar
                    </button>
                  )}
                </div>

                {/* Mode selector: raw (one company), combined (sum across companies), derived (formula) */}
                <div className="flex gap-2">
                  {(['raw', 'combined', 'derived'] as const).map(mode => (
                    <button
                      key={mode}
                      onClick={() => updateSeries(s.tempId, { mode })}
                      className={`flex-1 py-1 text-xs rounded border transition-colors ${
                        s.mode === mode
                          ? 'bg-gray-800 text-white border-gray-800'
                          : 'border-gray-300 text-gray-600 hover:border-gray-400'
                      }`}
                    >
                      {mode === 'raw' ? 'Una empresa' : mode === 'combined' ? 'Suma empresas' : 'Métrica derivada'}
                    </button>
                  ))}
                </div>

                {/* Raw mode: pick a single company + metric */}
                {s.mode === 'raw' && companies.length > 0 && (
                  <MetricSelector
                    companies={companies}
                    selectedCompanyId={s.companyId || companies[0].id}
                    selectedMetricName={s.metricName}
                    onCompanyChange={id => updateSeries(s.tempId, { companyId: id, metricName: '', label: '' })}
                    onMetricChange={name => {
                      // Always regenerate the label from the current company+metric so the legend
                      // never drifts from the underlying ref. If the user wants a custom label,
                      // they can type it in the label input afterwards (that edit happens last).
                      const co = companies.find(c => c.id === (s.companyId || companies[0].id))
                      updateSeries(s.tempId, {
                        metricName: name,
                        label: name && co ? `${name} — ${co.name}` : '',
                      })
                    }}
                  />
                )}

                {/* Combined mode: checkboxes to select which companies to sum, then pick the metric */}
                {s.mode === 'combined' && (
                  <div className="space-y-2">
                    <label className="block text-xs text-gray-500">Empresas a sumar:</label>
                    <div className="flex flex-wrap gap-2">
                      {companies.map(c => (
                        <label key={c.id} className="flex items-center gap-1 text-sm cursor-pointer">
                          <input
                            type="checkbox"
                            checked={s.combinedCompanyIds.includes(c.id)}
                            onChange={() => toggleCombinedCompany(s.tempId, c.id)}
                            className="rounded"
                          />
                          {c.name}
                        </label>
                      ))}
                    </div>
                    {s.combinedCompanyIds.length > 0 && (
                      <MetricSelector
                        companies={companies.filter(c => s.combinedCompanyIds.includes(c.id))}
                        selectedCompanyId={s.combinedCompanyIds[0]}
                        selectedMetricName={s.combinedMetricName}
                        onCompanyChange={() => {}}
                        onMetricChange={name => updateSeries(s.tempId, {
                          combinedMetricName: name,
                          label: s.label || `${name} (combinado)`,
                        })}
                        label="Métrica a sumar"
                      />
                    )}
                  </div>
                )}

                {/* Derived mode: select from the list of saved derived metrics */}
                {s.mode === 'derived' && (
                  <div>
                    {derivedMetrics.length === 0 ? (
                      <p className="text-xs text-gray-400">No hay métricas derivadas. Créalas en el panel lateral.</p>
                    ) : (
                      <select
                        value={s.derivedMetricId}
                        onChange={e => {
                          const dm = derivedMetrics.find(d => d.id === e.target.value)
                          updateSeries(s.tempId, { derivedMetricId: e.target.value, label: s.label || dm?.name || '' })
                        }}
                        className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">— Seleccionar —</option>
                        {derivedMetrics.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                      </select>
                    )}
                  </div>
                )}

                {/* Chart legend label — auto-generated if left blank */}
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Etiqueta en el gráfico</label>
                  <input
                    type="text"
                    value={s.label}
                    onChange={e => updateSeries(s.tempId, { label: e.target.value })}
                    placeholder="Auto-generada"
                    className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {error && <p className="text-red-500 text-sm">{error}</p>}

        <div className="flex gap-2 justify-end pt-2 border-t border-gray-100">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            className="px-5 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 font-medium"
          >
            {editing ? 'Guardar cambios' : 'Crear gráfico'}
          </button>
        </div>
      </div>
    </Modal>
  )
}

// ─── Edit-mode helper ───────────────────────────────────────────────────────────
// Convert saved PlotSeries back to SeriesForm for editing
function seriesFromConfig(s: import('../../types').PlotSeries, _companies: import('../../types').Company[]): SeriesForm {
  const base: SeriesForm = {
    tempId: s.id,
    label: s.label,
    mode: 'raw',
    companyId: '',
    metricName: '',
    combinedCompanyIds: [],
    combinedMetricName: '',
    combinedCompanyMetricName: '',
    derivedMetricId: '',
  }
  if (s.ref.type === 'raw') return { ...base, mode: 'raw', companyId: s.ref.companyId, metricName: s.ref.metricName }
  if (s.ref.type === 'combined') return { ...base, mode: 'combined', combinedCompanyIds: s.ref.companyIds, combinedMetricName: s.ref.metricName }
  if (s.ref.type === 'derived') return { ...base, mode: 'derived', derivedMetricId: s.ref.derivedMetricId }
  return base
}
