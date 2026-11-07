// Human-readable formula text for a derived metric, e.g. "Ventas + Costos − Impuestos".
// Shared by the sidebar list (fed a saved DerivedMetric) and
// DerivedMetricModal's live preview (fed in-progress form state, where an
// operand may not be picked yet — hence the nullable operand type here,
// looser than DerivedMetric's own saved shape).
import type { MetricRef, Operator } from '../types'

const OPERATOR_SYMBOL: Record<Operator, string> = { '+': '+', '-': '−', '*': '×', '/': '÷' }

function describeOperand(ref: MetricRef | null | undefined, fallback: string): string {
  if (!ref) return fallback
  if (ref.type === 'raw') return ref.metricName || fallback
  if (ref.type === 'combined') return ref.metricName || fallback
  return fallback // derived-on-derived: name isn't resolvable here without the full list
}

interface DescribableFormula {
  base: MetricRef | null | undefined
  terms: { operator: Operator; operand: MetricRef | null | undefined }[]
}

export function describeDerivedMetric(dm: DescribableFormula): string {
  const parts = [describeOperand(dm.base, 'Métrica')]
  for (const term of dm.terms) {
    parts.push(OPERATOR_SYMBOL[term.operator], describeOperand(term.operand, 'Métrica'))
  }
  return parts.join(' ')
}
