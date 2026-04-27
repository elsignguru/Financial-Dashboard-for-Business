// Left sidebar — lists all loaded companies (with per-company metric visibility controls)
// and all user-defined derived metrics. Also houses the CSV upload zone.
import { useState } from 'react'
import { useDataStore } from '../../store/useDataStore'
import { useMetricStore } from '../../store/useMetricStore'
import UploadZone from '../upload/UploadZone'
import DerivedMetricModal from './DerivedMetricModal'

// ─── CompanySection ─────────────────────────────────────────────────────────────
// Collapsible card for a single company. Shows metric count, a search box,
// and checkboxes to hide/show individual metrics in the chart selectors.
function CompanySection({ companyId }: { companyId: string }) {
  const company = useDataStore(s => s.companies.find(c => c.id === companyId))
  const removeCompany = useDataStore(s => s.removeCompany)
  const updateCompanyName = useDataStore(s => s.updateCompanyName)
  const toggleHide = useDataStore(s => s.toggleHideMetric)
  const isHidden = useDataStore(s => s.isMetricHidden)

  const [expanded, setExpanded] = useState(false)
  const [editingName, setEditingName] = useState(false)
  const [nameInput, setNameInput] = useState(company?.name ?? '')
  const [search, setSearch] = useState('')

  if (!company) return null

  // Build a section → metric name map filtered by the current search query.
  const grouped: Record<string, string[]> = {}
  for (const m of company.report.metrics) {
    if (!m.name.toLowerCase().includes(search.toLowerCase())) continue
    if (!grouped[m.section || 'General']) grouped[m.section || 'General'] = []
    grouped[m.section || 'General'].push(m.name)
  }

  const hiddenCount = company.report.metrics.filter(m => isHidden(companyId, m.name)).length

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      {/* Company header: toggle expand, inline rename, delete */}
      <div className="flex items-center justify-between px-3 py-2 bg-gray-50">
        {editingName ? (
          <input
            autoFocus
            value={nameInput}
            onChange={e => setNameInput(e.target.value)}
            onBlur={() => { updateCompanyName(companyId, nameInput.trim() || company.name); setEditingName(false) }}
            onKeyDown={e => { if (e.key === 'Enter') { updateCompanyName(companyId, nameInput.trim() || company.name); setEditingName(false) } }}
            className="flex-1 text-sm border border-blue-400 rounded px-1 py-0.5 focus:outline-none"
          />
        ) : (
          <button onClick={() => setExpanded(v => !v)} className="flex-1 text-left text-sm font-medium text-gray-800 truncate">
            {expanded ? '▾' : '▸'} {company.name}
          </button>
        )}
        <div className="flex gap-1 ml-1">
          <button onClick={() => { setEditingName(true); setNameInput(company.name) }} title="Renombrar" className="text-gray-400 hover:text-gray-600 text-xs px-1">✎</button>
          <button onClick={() => { if (confirm(`¿Eliminar ${company.name}?`)) removeCompany(companyId) }} title="Eliminar" className="text-gray-400 hover:text-red-500 text-xs px-1">✕</button>
        </div>
      </div>

      {/* Expanded metric list with search and hide toggles */}
      {expanded && (
        <div className="px-3 py-2 space-y-2">
          <p className="text-xs text-gray-400">
            {company.report.metrics.length} métricas
            {hiddenCount > 0 && <span className="ml-1 text-amber-500">({hiddenCount} ocultas)</span>}
          </p>
          <input
            type="text"
            placeholder="Buscar..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-400"
          />
          <div className="max-h-64 overflow-y-auto space-y-2 pr-1">
            {Object.entries(grouped).map(([section, names]) => (
              <div key={section}>
                <p className="text-xs font-medium text-gray-500 mb-1 sticky top-0 bg-white">{section}</p>
                {names.map(name => {
                  const hidden = isHidden(companyId, name)
                  return (
                    <label key={name} className="flex items-center gap-2 cursor-pointer py-0.5">
                      <input
                        type="checkbox"
                        checked={!hidden}
                        onChange={() => toggleHide(companyId, name)}
                        className="rounded shrink-0"
                      />
                      <span className={`text-xs truncate ${hidden ? 'line-through text-gray-400' : 'text-gray-700'}`}>{name}</span>
                    </label>
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Sidebar ────────────────────────────────────────────────────────────────────
export default function Sidebar() {
  const companies = useDataStore(s => s.companies)
  const derivedMetrics = useMetricStore(s => s.derivedMetrics)
  const removeDerived = useMetricStore(s => s.removeDerivedMetric)
  const [addingDerived, setAddingDerived] = useState(false)

  return (
    <>
      <aside className="w-64 shrink-0 bg-white border-r border-gray-200 flex flex-col h-full overflow-y-auto">
        {/* Logo / title */}
        <div className="px-4 py-4 border-b border-gray-200">
          <h1 className="text-base font-bold text-gray-900">Grupo Filippo</h1>
          <p className="text-xs text-gray-400 mt-0.5">Dashboard Financiero</p>
        </div>

        <div className="flex-1 px-3 py-3 space-y-4 overflow-y-auto">
          {/* Companies section — one CompanySection card per uploaded CSV */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 px-1">Empresas</p>
            <div className="space-y-2">
              {companies.map(c => <CompanySection key={c.id} companyId={c.id} />)}
              <UploadZone />
            </div>
          </div>

          {/* Derived metrics section — lists formulas created via DerivedMetricModal */}
          <div>
            <div className="flex items-center justify-between mb-2 px-1">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Métricas Derivadas</p>
              {companies.length > 0 && (
                <button onClick={() => setAddingDerived(true)} className="text-xs text-blue-600 hover:text-blue-800 font-medium">
                  + Nueva
                </button>
              )}
            </div>
            {derivedMetrics.length === 0 ? (
              <p className="text-xs text-gray-400 px-1">
                {companies.length === 0 ? 'Sube datos primero.' : 'Ninguna creada aún.'}
              </p>
            ) : (
              <div className="space-y-1">
                {derivedMetrics.map(dm => (
                  <div key={dm.id} className="flex items-center justify-between px-2 py-1.5 rounded hover:bg-gray-50 group">
                    <div className="min-w-0">
                      <p className="text-sm text-gray-700 truncate">{dm.name}</p>
                      <p className="text-xs text-gray-400">A {dm.operator} B</p>
                    </div>
                    <button
                      onClick={() => { if (confirm(`¿Eliminar "${dm.name}"?`)) removeDerived(dm.id) }}
                      className="text-gray-300 hover:text-red-500 text-xs ml-1 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </aside>

      <DerivedMetricModal open={addingDerived} onClose={() => setAddingDerived(false)} />
    </>
  )
}
