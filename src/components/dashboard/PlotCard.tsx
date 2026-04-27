// A single chart card on the dashboard grid.
// Renders the chart title, period selectors, edit/delete controls, and the chart itself.
import { useState } from 'react'
import type { PlotConfig } from '../../types'
import { useLayoutStore } from '../../store/useLayoutStore'
import { useDataStore } from '../../store/useDataStore'
import ChartContainer from '../charts/ChartContainer'
import AddPlotModal from './AddPlotModal'
import { formatDateFull } from '../../utils/dateUtils'

export default function PlotCard({ plot }: { plot: PlotConfig }) {
  const removePlot = useLayoutStore(s => s.removePlot)
  const updatePlot = useLayoutStore(s => s.updatePlot)
  const allDates = useDataStore(s => s.allDates)
  const [editing, setEditing] = useState(false)

  const dates = allDates()

  return (
    <>
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 flex flex-col">
        {/* Card header: title, period pickers, and action buttons */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-800 truncate flex-1">{plot.title}</h3>
          <div className="flex items-center gap-1 ml-2 shrink-0">
            {/* Period selectors — changing either updates the plot config in the store immediately */}
            <select
              value={plot.periodStart}
              onChange={e => updatePlot(plot.id, { periodStart: e.target.value })}
              className="text-xs border border-gray-200 rounded px-1 py-0.5 text-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-400"
            >
              {dates.map(d => <option key={d} value={d}>{formatDateFull(d)}</option>)}
            </select>
            <span className="text-gray-300 text-xs">→</span>
            <select
              value={plot.periodEnd}
              onChange={e => updatePlot(plot.id, { periodEnd: e.target.value })}
              className="text-xs border border-gray-200 rounded px-1 py-0.5 text-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-400"
            >
              {dates.map(d => <option key={d} value={d}>{formatDateFull(d)}</option>)}
            </select>
            {/* Edit opens AddPlotModal pre-populated with this plot's config */}
            <button
              onClick={() => setEditing(true)}
              title="Editar"
              className="ml-1 p-1 text-gray-400 hover:text-blue-600 transition-colors rounded hover:bg-gray-50"
            >
              ✎
            </button>
            <button
              onClick={() => { if (confirm('¿Eliminar este gráfico?')) removePlot(plot.id) }}
              title="Eliminar"
              className="p-1 text-gray-400 hover:text-red-500 transition-colors rounded hover:bg-gray-50"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Chart area — explicit height required so ResponsiveContainer gets a non-zero measurement */}
        <div className="p-3" style={{ height: 280 }}>
          <ChartContainer plot={plot} />
        </div>
      </div>

      {editing && <AddPlotModal open onClose={() => setEditing(false)} editingPlotId={plot.id} />}
    </>
  )
}
