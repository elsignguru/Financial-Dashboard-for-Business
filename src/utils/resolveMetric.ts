// Resolves a MetricRef into an array of TimeSeriesPoints for a given date range.
// This is the core data-fetching layer — charts call resolveMetric to get the values they render.
import type { Company, DerivedMetric, MetricRef, Operator, TimeSeriesPoint } from '../types'

// ─── Resolution strategies ──────────────────────────────────────────────────────

// Fetches one metric from one company, filtered to the requested date range.
function resolveRaw(
  companyId: string,
  metricName: string,
  start: string,
  end: string,
  companies: Company[]
): TimeSeriesPoint[] {
  const company = companies.find(c => c.id === companyId)
  if (!company) return []
  const metric = company.report.metrics.find(m => m.name === metricName)
  if (!metric) return []
  return company.report.dates
    .filter(d => d >= start && d <= end)
    .map(d => ({ date: d, value: metric.data[d] ?? null }))
}

// Sums the same metric across multiple companies for each month.
// Months present in any company are included; null is returned only when no company has a value.
function resolveCombined(
  metricName: string,
  companyIds: string[],
  start: string,
  end: string,
  companies: Company[]
): TimeSeriesPoint[] {
  const relevant = companies.filter(c => companyIds.includes(c.id))
  const allDates = new Set<string>()
  for (const c of relevant) {
    c.report.dates.filter(d => d >= start && d <= end).forEach(d => allDates.add(d))
  }
  return Array.from(allDates).sort().map(date => {
    let sum = 0
    let hasValue = false
    for (const c of relevant) {
      const metric = c.report.metrics.find(m => m.name === metricName)
      const val = metric?.data[date]
      if (val != null) { sum += val; hasValue = true }
    }
    return { date, value: hasValue ? sum : null }
  })
}

function applyOperator(a: number, b: number, operator: Operator): number | null {
  if (operator === '+') return a + b
  if (operator === '-') return a - b
  if (operator === '*') return a * b
  if (operator === '/') return b !== 0 ? a / b : null
  return null
}

// Combines two already-resolved series point-by-point by date. Null wherever
// either side is null (or missing), matching how a single A op B pair always behaved.
function combineSeries(a: TimeSeriesPoint[], b: TimeSeriesPoint[], operator: Operator): TimeSeriesPoint[] {
  const bMap = new Map(b.map(p => [p.date, p.value]))
  return a.map(p => {
    const bVal = bMap.get(p.date)
    if (p.value == null || bVal == null) return { date: p.date, value: null }
    return { date: p.date, value: applyOperator(p.value, bVal, operator) }
  })
}

// ─── Main resolver ──────────────────────────────────────────────────────────────

// Dispatches to the correct strategy based on the MetricRef type.
// Derived metrics are resolved recursively — each operand can itself be any MetricRef type.
export function resolveMetric(
  ref: MetricRef,
  start: string,
  end: string,
  companies: Company[],
  derivedMetrics: DerivedMetric[]
): TimeSeriesPoint[] {
  if (ref.type === 'raw') {
    return resolveRaw(ref.companyId, ref.metricName, start, end, companies)
  }
  if (ref.type === 'combined') {
    return resolveCombined(ref.metricName, ref.companyIds, start, end, companies)
  }
  if (ref.type === 'derived') {
    const dm = derivedMetrics.find(d => d.id === ref.derivedMetricId)
    if (!dm) return []
    let result = resolveMetric(dm.base, start, end, companies, derivedMetrics)
    for (const term of dm.terms) {
      const termPoints = resolveMetric(term.operand, start, end, companies, derivedMetrics)
      result = combineSeries(result, termPoints, term.operator)
    }
    return result
  }
  return []
}
