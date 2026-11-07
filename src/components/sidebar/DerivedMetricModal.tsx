// Modal for creating a derived metric — a named arithmetic formula chaining
// any number of operands left-to-right (A op B op C op D...), where each
// operand is a raw metric from any loaded company.
import { useState } from 'react'
import Modal from '../ui/Modal'
import MetricSelector from '../metrics/MetricSelector'
import { useDataStore } from '../../store/useDataStore'
import { useMetricStore } from '../../store/useMetricStore'
import { describeDerivedMetric } from '../../utils/derivedMetric'
import type { DerivedMetricTerm, MetricRef, Operator } from '../../types'

interface Props {
  open: boolean
  onClose: () => void
}

const OPERATORS: { value: Operator; label: string }[] = [
  { value: '+', label: '+' },
  { value: '-', label: '−' },
  { value: '*', label: '×' },
  { value: '/', label: '÷' },
]

interface OperandForm {
  companyId: string
  metricName: string
}

function emptyOperand(): OperandForm {
  return { companyId: '', metricName: '' }
}

interface TermForm {
  // Random suffix matters — see the same note in AddPlotModal's newSeries():
  // Date.now() alone collides if terms are added within the same millisecond.
  tempId: string
  operator: Operator
  operand: OperandForm
}

function newTerm(): TermForm {
  return { tempId: `tmp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`, operator: '+', operand: emptyOperand() }
}

export default function DerivedMetricModal({ open, onClose }: Props) {
  const companies = useDataStore(s => s.companies)
  const addDerived = useMetricStore(s => s.addDerivedMetric)

  // ─── Form state ──────────────────────────────────────────────────────────────
  const [name, setName] = useState('')
  const [base, setBase] = useState(emptyOperand())
  const [terms, setTerms] = useState<TermForm[]>([newTerm()])
  const [error, setError] = useState('')

  function updateTerm(tempId: string, patch: Partial<TermForm>) {
    setTerms(prev => prev.map(t => t.tempId === tempId ? { ...t, ...patch } : t))
  }

  function operandRef(o: OperandForm): MetricRef {
    const companyId = o.companyId || companies[0]?.id || ''
    return { type: 'raw', companyId, metricName: o.metricName }
  }

  // Live text preview — reuses the same formatter as the sidebar's list, fed
  // directly from current form state rather than a saved DerivedMetric.
  const preview = describeDerivedMetric({
    base: base.metricName ? operandRef(base) : null,
    terms: terms.map(t => ({ operator: t.operator, operand: t.operand.metricName ? operandRef(t.operand) : null })),
  })

  function resetForm() {
    setName(''); setBase(emptyOperand()); setTerms([newTerm()])
  }

  // Validates inputs then persists the formula to the metric store.
  function handleSubmit() {
    setError('')
    if (!name.trim()) { setError('Ingresa un nombre'); return }
    if (!base.metricName) { setError('Selecciona la primera métrica'); return }
    if (terms.some(t => !t.operand.metricName)) { setError('Completa todas las métricas de la fórmula'); return }

    const derivedTerms: DerivedMetricTerm[] = terms.map(t => ({ operator: t.operator, operand: operandRef(t.operand) }))
    addDerived({ name: name.trim(), base: operandRef(base), terms: derivedTerms })
    resetForm()
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

        {/* Formula preview — updates live as the user builds the formula */}
        <div className="bg-gray-50 rounded-lg p-3 text-xs text-gray-500 text-center">
          Resultado = <strong className="text-gray-700">{preview}</strong>
        </div>

        {/* Base operand — the "A" with no operator in front of it */}
        <div>
          <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Primera métrica</label>
          <MetricSelector
            companies={companies}
            selectedCompanyId={base.companyId || companies[0]?.id || ''}
            selectedMetricName={base.metricName}
            onCompanyChange={id => setBase({ companyId: id, metricName: '' })}
            onMetricChange={metricName => setBase(prev => ({ ...prev, metricName }))}
          />
        </div>

        {/* Chained terms — each adds "op + metric" onto the running result */}
        <div className="space-y-3">
          {terms.map((t, idx) => (
            <div key={t.tempId} className="border border-gray-200 rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-gray-500">Término {idx + 1}</span>
                {terms.length > 1 && (
                  <button
                    onClick={() => setTerms(prev => prev.filter(x => x.tempId !== t.tempId))}
                    className="text-xs text-red-500 hover:text-red-700"
                  >
                    Eliminar
                  </button>
                )}
              </div>

              {/* Operator picker for this term */}
              <div className="grid grid-cols-4 gap-1">
                {OPERATORS.map(op => (
                  <button
                    key={op.value}
                    onClick={() => updateTerm(t.tempId, { operator: op.value })}
                    className={`py-1 text-sm rounded border transition-colors ${
                      t.operator === op.value
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'border-gray-300 text-gray-600 hover:border-gray-400'
                    }`}
                  >
                    {op.label}
                  </button>
                ))}
              </div>

              <MetricSelector
                companies={companies}
                selectedCompanyId={t.operand.companyId || companies[0]?.id || ''}
                selectedMetricName={t.operand.metricName}
                onCompanyChange={id => updateTerm(t.tempId, { operand: { companyId: id, metricName: '' } })}
                onMetricChange={metricName => updateTerm(t.tempId, { operand: { ...t.operand, metricName } })}
              />
            </div>
          ))}

          <button
            onClick={() => setTerms(prev => [...prev, newTerm()])}
            className="text-xs text-blue-600 hover:text-blue-800 font-medium"
          >
            + Agregar término
          </button>
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
