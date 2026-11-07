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

// Folds a derived metric's base + chained terms into one series, one month
// at a time. A missing operand (QuickBooks has no transactions posted to
// that account that month — see qboTransform.ts's parseValue, which is
// exactly where that null first comes from) counts as 0 for the arithmetic,
// same rule resolveCombined already uses when summing across companies —
// only when EVERY operand is missing that month does the result stay null,
// so a period with no data anywhere isn't misrepresented as a hard zero.
// A genuine divide-by-zero mid-chain nulls the whole month instead of
// silently resetting to 0 and continuing, since that's a real error, not
// just absent data.
function resolveDerived(
  dm: DerivedMetric,
  start: string,
  end: string,
  companies: Company[],
  derivedMetrics: DerivedMetric[]
): TimeSeriesPoint[] {
  const basePoints = resolveMetric(dm.base, start, end, companies, derivedMetrics)
  const termSeries = dm.terms.map(term => ({
    operator: term.operator,
    points: resolveMetric(term.operand, start, end, companies, derivedMetrics),
  }))

  const allDates = new Set(basePoints.map(p => p.date))
  for (const t of termSeries) for (const p of t.points) allDates.add(p.date)

  const baseMap = new Map(basePoints.map(p => [p.date, p.value]))
  const termMaps = termSeries.map(t => ({ operator: t.operator, map: new Map(t.points.map(p => [p.date, p.value])) }))

  return Array.from(allDates).sort().map(date => {
    let result = baseMap.get(date) ?? 0
    let anyValue = (baseMap.get(date) ?? null) != null
    let invalid = false

    for (const t of termMaps) {
      const raw = t.map.get(date) ?? null
      if (raw != null) anyValue = true
      const next = applyOperator(result, raw ?? 0, t.operator)
      if (next == null) { invalid = true; break }
      result = next
    }

    return { date, value: invalid || !anyValue ? null : result }
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
    return resolveDerived(dm, start, end, companies, derivedMetrics)
  }
  return []
}
