// Central type definitions for the entire application.

// ─── Primitive enums ───────────────────────────────────────────────────────────

export type ChartType = 'line' | 'bar' | 'pie'
export type MetricRowType = 'leaf' | 'subtotal' | 'summary'
export type Operator = '+' | '-' | '*' | '/'

// ─── CSV / Report data model ───────────────────────────────────────────────────

// A single row from a parsed financial report (e.g. "Ventas Netas").
export interface MetricRow {
  name: string
  section: string
  type: MetricRowType
  data: Record<string, number | null>  // key: "YYYY-MM"
}

// The full output of parsing one company's CSV file.
export interface ParsedReport {
  companyName: string
  currency: string
  dates: string[]  // ["2024-01", "2024-02", ...]
  metrics: MetricRow[]
}

// A company loaded into the app — wraps its parsed report with a stable ID.
// qboStatus/lastSyncedAt/lastSyncError mirror the `companies` table and drive
// the connection-status UI in the sidebar.
export interface Company {
  id: string
  name: string
  report: ParsedReport
  qboStatus?: 'connected' | 'error' | 'disconnected'
  lastSyncedAt?: string | null
  lastSyncError?: string | null
}

// ─── Metric references ─────────────────────────────────────────────────────────

// Describes where a chart series gets its data from.
// - raw: a single metric from a single company
// - combined: the same metric summed across multiple companies
// - derived: a user-defined formula (A op B) stored in useMetricStore
export type MetricRef =
  | { type: 'raw'; companyId: string; metricName: string }
  | { type: 'combined'; metricName: string; companyIds: string[] }
  | { type: 'derived'; derivedMetricId: string }

// ─── Chart / Plot configuration ────────────────────────────────────────────────

// One data series within a chart, with its display label and data reference.
export interface PlotSeries {
  id: string
  label: string
  ref: MetricRef
}

// Full configuration for a chart card on the dashboard grid.
// yAxisMin/yAxisMax are optional manual Y-axis bounds (line/bar charts
// only) — null/undefined means auto-scaled from the data.
export interface PlotConfig {
  id: string
  title: string
  chartType: ChartType
  series: PlotSeries[]
  periodStart: string
  periodEnd: string
  yAxisMin?: number | null
  yAxisMax?: number | null
}

// ─── Derived metrics ───────────────────────────────────────────────────────────

// A user-created formula that combines two MetricRefs with an arithmetic operator.
export interface DerivedMetric {
  id: string
  name: string
  operandA: MetricRef
  operator: Operator
  operandB: MetricRef
}

// A resolved data point returned by resolveMetric — one month's value for a series.
export interface TimeSeriesPoint {
  date: string
  value: number | null
}
