// Main dashboard area — renders the grid of chart cards.
// Shows context-appropriate empty states when no data or no plots exist.
import { useState } from 'react'
import { useLayoutStore } from '../../store/useLayoutStore'
import { useDataStore } from '../../store/useDataStore'
import PlotCard from './PlotCard'
import AddPlotModal from './AddPlotModal'

export default function DashboardGrid() {
  const plots = useLayoutStore(s => s.plots)
  const companies = useDataStore(s => s.companies)
  const [adding, setAdding] = useState(false)

  // Empty state 1: no companies loaded yet — prompt user to upload a CSV.
  if (!companies.length) {
    return (
      <div className="flex flex-col items-center justify-center flex-1 text-center p-12">
        <div className="text-5xl mb-4">📊</div>
        <h2 className="text-xl font-semibold text-gray-700 mb-2">Sin datos</h2>
        <p className="text-gray-400 text-sm max-w-xs">
          Sube el CSV de una empresa desde el panel lateral para comenzar a crear gráficos.
        </p>
      </div>
    )
  }

  return (
    <div className="p-6 flex-1">
      {plots.length === 0 ? (
        // Empty state 2: companies loaded but no plots created yet.
        <div className="flex flex-col items-center justify-center h-64 text-center">
          <div className="text-4xl mb-3">＋</div>
          <p className="text-gray-500 text-sm mb-4">No hay gráficos. Crea el primero.</p>
          <button
            onClick={() => setAdding(true)}
            className="px-5 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 font-medium"
          >
            Crear gráfico
          </button>
        </div>
      ) : (
        <>
          {/* Responsive grid: 1 column by default, 2 columns on xl screens */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
            {plots.map(plot => <PlotCard key={plot.id} plot={plot} />)}
          </div>
          <button
            onClick={() => setAdding(true)}
            className="mt-5 flex items-center gap-2 px-4 py-2 text-sm text-blue-600 border border-blue-300 rounded-lg hover:bg-blue-50 transition-colors"
          >
            <span className="text-lg leading-none">+</span>
            Agregar gráfico
          </button>
        </>
      )}
      {adding && <AddPlotModal open onClose={() => setAdding(false)} />}
    </div>
  )
}
