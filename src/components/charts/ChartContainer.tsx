// Resolves a PlotConfig's series into time-series data and renders the appropriate Recharts chart.
// Supports three chart types: line, bar, and pie.
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts'
import type { PlotConfig, TimeSeriesPoint } from '../../types'
import { useDataStore } from '../../store/useDataStore'
import { useMetricStore } from '../../store/useMetricStore'
import { resolveMetric } from '../../utils/resolveMetric'
import { getColor } from '../../utils/colors'
import { formatDate, formatValue, formatValueShort } from '../../utils/dateUtils'
import { computeYAxisScale } from '../../utils/niceTicks'

interface SeriesData {
  label: string
  color: string
  points: TimeSeriesPoint[]
}

// ─── Data resolution hook ───────────────────────────────────────────────────────
// Reads companies and derived metrics from the stores, then calls resolveMetric
// for each series in the plot to produce labelled, coloured time-series arrays.
function useSeriesData(plot: PlotConfig): SeriesData[] {
  const companies = useDataStore(s => s.companies)
  const derivedMetrics = useMetricStore(s => s.derivedMetrics)
  return plot.series.map((s, i) => ({
    label: s.label,
    color: getColor(i),
    points: resolveMetric(s.ref, plot.periodStart, plot.periodEnd, companies, derivedMetrics),
  }))
}

// ─── Recharts data transformer ──────────────────────────────────────────────────
// Merges all series onto a shared date axis. We key each series' value column by its
// INDEX (s0, s1, ...) rather than by the user-facing label so that (a) two series with
// the same label can't silently clobber each other, and (b) labels containing Recharts'
// special dataKey characters (".", "[", "]") aren't misinterpreted as nested paths.
function mergeForRecharts(seriesData: SeriesData[]) {
  if (!seriesData.length) return []
  const allDates = Array.from(
    new Set(seriesData.flatMap(s => s.points.map(p => p.date)))
  ).sort()
  return allDates.map(date => {
    const row: Record<string, string | number | null> = { date, dateLabel: formatDate(date) }
    seriesData.forEach((s, i) => {
      const pt = s.points.find(p => p.date === date)
      row[`s${i}`] = pt?.value ?? null
    })
    return row
  })
}

// Scans every series' value in the merged rows to find the overall min/max,
// so the Y-axis scale always covers everything plotted (Recharts' own
// `dataMin`/`dataMax` domain keywords only look at ONE dataKey at a time,
// not all of them together).
function dataRange(chartData: Record<string, string | number | null>[], seriesCount: number): [number, number] {
  let min = Infinity
  let max = -Infinity
  for (const row of chartData) {
    for (let i = 0; i < seriesCount; i++) {
      const v = row[`s${i}`]
      if (typeof v === 'number') {
        if (v < min) min = v
        if (v > max) max = v
      }
    }
  }
  if (min === Infinity) return [0, 1] // no numeric data at all
  if (min > 0) min = 0 // always include the zero baseline unless data goes negative
  return [min, max]
}

// ─── Custom tooltip ─────────────────────────────────────────────────────────────
// Shows all series values for the hovered month with CRC formatting.
const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{name: string; value: number; color: string}>; label?: string }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-gray-200 rounded shadow-lg p-3 text-xs">
      <p className="font-semibold text-gray-700 mb-1">{label}</p>
      {payload.map(entry => (
        <p key={entry.name} style={{ color: entry.color }}>
          {entry.name}: {entry.value != null ? formatValue(entry.value) : '—'}
        </p>
      ))}
    </div>
  )
}

// ─── Chart renderer ─────────────────────────────────────────────────────────────
export default function ChartContainer({ plot }: { plot: PlotConfig }) {
  const seriesData = useSeriesData(plot)
  const chartData = mergeForRecharts(seriesData)

  if (!plot.series.length) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400 text-sm">
        Sin series — edita el gráfico para agregar datos
      </div>
    )
  }

  // Pie chart: sums each series over the full period and shows share percentages.
  if (plot.chartType === 'pie') {
    const pieData = seriesData.map((s, i) => {
      const total = s.points.reduce((acc, p) => acc + (p.value ?? 0), 0)
      return { name: s.label, value: total, color: getColor(i) }
    })
    return (
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius="70%" label={({ name, percent }) => `${name} ${percent != null ? (percent * 100).toFixed(0) : 0}%`}>
            {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
          </Pie>
          <Tooltip formatter={(v) => formatValue(v as number)} />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    )
  }

  // Uniform, clean Y-axis gridlines (round numbers, evenly spaced) rather
  // than Recharts' default auto-ticks — honors plot.yAxisMin/Max when set,
  // otherwise computed from the data.
  const [dataMin, dataMax] = dataRange(chartData, seriesData.length)
  const yScale = computeYAxisScale(dataMin, dataMax, plot.yAxisMin, plot.yAxisMax)

  // Bar chart: stacked by default, one bar per month.
  if (plot.chartType === 'bar') {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ top: 4, right: 8, left: 8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="dateLabel" tick={{ fontSize: 11 }} />
          <YAxis domain={yScale.domain} ticks={yScale.ticks} tickFormatter={formatValueShort} tick={{ fontSize: 11 }} width={56} />
          <Tooltip content={<CustomTooltip />} />
          {seriesData.length > 1 && <Legend wrapperStyle={{ fontSize: 12 }} />}
          {seriesData.map((s, i) => (
            <Bar key={`s${i}`} name={s.label} dataKey={`s${i}`} fill={s.color} radius={[2, 2, 0, 0]} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    )
  }

  // Line chart (default): one line per series, nulls shown as gaps rather than zero.
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={chartData} margin={{ top: 4, right: 8, left: 8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey="dateLabel" tick={{ fontSize: 11 }} />
        <YAxis domain={yScale.domain} ticks={yScale.ticks} tickFormatter={formatValueShort} tick={{ fontSize: 11 }} width={56} />
        <Tooltip content={<CustomTooltip />} />
        {seriesData.length > 1 && <Legend wrapperStyle={{ fontSize: 12 }} />}
        {seriesData.map((s, i) => (
          <Line
            key={`s${i}`}
            name={s.label}
            type="monotone"
            dataKey={`s${i}`}
            stroke={s.color}
            strokeWidth={2}
            dot={{ r: 3, fill: s.color, strokeWidth: 0 }}
            connectNulls={false}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  )
}
