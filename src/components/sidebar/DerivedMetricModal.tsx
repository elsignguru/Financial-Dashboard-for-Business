// Modal for creating a derived metric — a named arithmetic formula (A op B)
// where A and B are each a raw metric from any loaded company.
import { useState } from 'react'
import Modal from '../ui/Modal'
import MetricSelector from '../metrics/MetricSelector'
import { useDataStore } from '../../store/useDataStore'
import { useMetricStore } from '../../store/useMetricStore'
import type { MetricRef, Operator } from '../../types'

interface Props {
  open: boolean
  onClose: () => void
}

const OPERATORS: { value: Operator; label: string }[] = [
  { value: '+', label: '+ (suma)' },
  { value: '-', label: '− (resta)' },
  { value: '*', label: '× (producto)' },
  { value: '/', label: '÷ (división)' },
]

function emptyRef(): { companyId: string; metricName: string } {
  return { companyId: '', metricName: '' }
}

export default function DerivedMetricModal({ open, onClose }: Props) {
  const companies = useDataStore(s => s.companies)
  const addDerived = useMetricStore(s => s.addDerivedMetric)

  // ─── Form state ──────────────────────────────────────────────────────────────
  const [name, setName] = useState('')
  const [operator, setOperator] = useState<Operator>('/')
  const [refA, setRefA] = useState(emptyRef())
  const [refB, setRefB] = useState(emptyRef())
  const [error, setError] = useState('')

  // Validates inputs then persists the formula to the metric store.
  function handleSubmit() {
    setError('')
    // Use the same company fallback as MetricSelector so the implicit pre-selection is honoured.
    const companyIdA = refA.companyId || companies[0]?.id || ''
    const companyIdB = refB.companyId || companies[0]?.id || ''
    if (!name.trim()) { setError('Ingresa un nombre'); return }
    if (!companyIdA || !refA.metricName) { setError('Selecciona la métrica A'); return }
    if (!companyIdB || !refB.metricName) { setError('Selecciona la métrica B'); return }

    const operandA: MetricRef = { type: 'raw', companyId: companyIdA, metricName: refA.metricName }
    const operandB: MetricRef = { type: 'raw', companyId: companyIdB, metricName: refB.metricName }
    addDerived({ name: name.trim(), operator, operandA, operandB })
    setName(''); setRefA(emptyRef()); setRefB(emptyRef()); setOperator('/')
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title="Nueva métrica derivada" width="max-w-lg">
      <div className="space-y-4">
        {/* Name input */}
        <div>
          <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Nombre</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Ej: Margen Bruto, Ratio Ventas"
            className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Formula preview — updates live as the user selects an operator */}
        <div className="bg-gray-50 rounded-lg p-3 text-xs text-gray-500 text-center">
          Resultado = <strong className="text-gray-700">Métrica A</strong>
          {' '}<span className="font-mono bg-white border border-gray-200 rounded px-1 py-0.5">{operator}</span>{' '}
          <strong className="text-gray-700">Métrica B</strong>
        </div>

        {/* Operator picker — four toggle buttons */}
        <div>
          <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Operación</label>
          <div className="grid grid-cols-4 gap-1">
            {OPERATORS.map(op => (
              <button
                key={op.value}
                onClick={() => setOperator(op.value)}
                className={`py-1.5 text-sm rounded border transition-colors ${
                  operator === op.value
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'border-gray-300 text-gray-600 hover:border-gray-400'
                }`}
              >
                {op.label}
              </button>
            ))}
          </div>
        </div>

        {/* Side-by-side metric selectors for operand A and operand B */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <MetricSelector
              companies={companies}
              selectedCompanyId={refA.companyId || companies[0]?.id || ''}
              selectedMetricName={refA.metricName}
              onCompanyChange={id => setRefA({ companyId: id, metricName: '' })}
              onMetricChange={name => setRefA(prev => ({ ...prev, metricName: name }))}
              label="Métrica A"
            />
          </div>
          <div>
            <MetricSelector
              companies={companies}
              selectedCompanyId={refB.companyId || companies[0]?.id || ''}
              selectedMetricName={refB.metricName}
              onCompanyChange={id => setRefB({ companyId: id, metricName: '' })}
              onMetricChange={name => setRefB(prev => ({ ...prev, metricName: name }))}
              label="Métrica B"
            />
          </div>
        </div>

        {error && <p className="text-red-500 text-sm">{error}</p>}

        <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">Cancelar</button>
          <button
            onClick={handleSubmit}
            className="px-5 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 font-medium"
          >
            Crear
          </button>
        </div>
      </div>
    </Modal>
  )
}
