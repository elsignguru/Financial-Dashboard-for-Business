// Compound input used wherever a user needs to pick one metric from one company.
// Renders: (1) a company dropdown if multiple companies are loaded,
//          (2) a search input to filter metrics, and
//          (3) a scrollable list grouped by section.
import { useState, useMemo } from 'react'
import type { Company, MetricRow } from '../../types'
import { useDataStore } from '../../store/useDataStore'

interface Props {
  companies: Company[]
  selectedCompanyId: string
  selectedMetricName: string
  onCompanyChange: (id: string) => void
  onMetricChange: (name: string) => void
  label?: string
}

// Groups metrics by their section heading, excluding any the user has hidden in the sidebar.
function groupMetrics(metrics: MetricRow[], hiddenFn: (name: string) => boolean) {
  const groups: Record<string, MetricRow[]> = {}
  for (const m of metrics) {
    if (hiddenFn(m.name)) continue
    const sec = m.section || 'Sin sección'
    if (!groups[sec]) groups[sec] = []
    groups[sec].push(m)
  }
  return groups
}

export default function MetricSelector({ companies, selectedCompanyId, selectedMetricName, onCompanyChange, onMetricChange, label }: Props) {
  const [search, setSearch] = useState('')
  const isHidden = useDataStore(s => s.isMetricHidden)

  const selectedCompany = companies.find(c => c.id === selectedCompanyId)

  // Re-filter and re-group only when the selected company, search text, or hidden list changes.
  const filteredGroups = useMemo(() => {
    if (!selectedCompany) return {}
    const metrics = selectedCompany.report.metrics.filter(m =>
      m.name.toLowerCase().includes(search.toLowerCase())
    )
    return groupMetrics(metrics, name => isHidden(selectedCompanyId, name))
  }, [selectedCompany, search, selectedCompanyId, isHidden])

  return (
    <div className="space-y-2">
      {label && <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</label>}

      {/* Company picker — only shown when more than one company is loaded */}
      {companies.length > 1 && (
        <select
          value={selectedCompanyId}
          onChange={e => { onCompanyChange(e.target.value); onMetricChange('') }}
          className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">— Empresa —</option>
          {companies.map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      )}

      {/* Metric search + list — only shown once a company is selected */}
      {selectedCompanyId && (
        <>
          <input
            type="text"
            placeholder="Buscar métrica..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {/* Scrollable grouped list — ∑ marks subtotals, ● marks summary rows */}
          <select
            value={selectedMetricName}
            onChange={e => onMetricChange(e.target.value)}
            size={8}
            className="w-full border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">— Seleccionar métrica —</option>
            {Object.entries(filteredGroups).map(([section, metrics]) => (
              <optgroup key={section} label={section}>
                {metrics.map(m => (
                  <option key={m.name} value={m.name}>
                    {m.type === 'subtotal' ? '∑ ' : m.type === 'summary' ? '● ' : '  '}
                    {m.name}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </>
      )}
    </div>
  )
}
