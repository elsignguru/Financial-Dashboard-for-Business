// Date and number formatting utilities used throughout the dashboard UI.

// ─── Spanish month name tables ──────────────────────────────────────────────────
export const MONTHS_SHORT = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']
const MONTHS_FULL = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

// ─── Date formatters ────────────────────────────────────────────────────────────

// Compact label used on chart X-axes: "2024-01" → "Ene '24"
export function formatDate(dateStr: string): string {
  // "2024-01" → "Ene '24"
  const [year, month] = dateStr.split('-')
  const m = parseInt(month) - 1
  return `${MONTHS_SHORT[m]} '${year.slice(2)}`
}

// Full label used in period pickers: "2024-01" → "Enero 2024"
export function formatDateFull(dateStr: string): string {
  // "2024-01" → "Enero 2024"
  const [year, month] = dateStr.split('-')
  return `${MONTHS_FULL[parseInt(month) - 1]} ${year}`
}

// ─── Number formatters ──────────────────────────────────────────────────────────

// Formats a value for tooltips. Large CRC values get M/K suffixes; small decimals (ratios) get 4 decimal places.
export function formatValue(value: number, currency = 'CRC'): string {
  const abs = Math.abs(value)
  const sign = value < 0 ? '-' : ''
  if (abs >= 1_000_000) return `${sign}${currency} ${(abs / 1_000_000).toFixed(2)}M`
  if (abs >= 1_000) return `${sign}${currency} ${(abs / 1_000).toFixed(1)}K`
  if (abs >= 1) return `${sign}${currency} ${abs.toFixed(2)}`
  // Values < 1 are ratios (e.g. from A/B derived metrics) — show as plain decimal, no currency prefix.
  return `${sign}${abs.toFixed(4)}`
}

// Same logic without currency prefix — used for Y-axis tick labels where space is limited.
export function formatValueShort(value: number): string {
  const abs = Math.abs(value)
  const sign = value < 0 ? '-' : ''
  if (abs >= 1_000_000) return `${sign}${(abs / 1_000_000).toFixed(1)}M`
  if (abs >= 1_000) return `${sign}${(abs / 1_000).toFixed(0)}K`
  if (abs >= 1) return `${sign}${abs.toFixed(1)}`
  return `${sign}${abs.toFixed(3)}`
}

// ─── Date range helpers ─────────────────────────────────────────────────────────

// Returns all month strings between start and end inclusive
export function monthRange(start: string, end: string): string[] {
  const result: string[] = []
  let [y, m] = start.split('-').map(Number)
  const [ey, em] = end.split('-').map(Number)
  while (y < ey || (y === ey && m <= em)) {
    result.push(`${y}-${String(m).padStart(2, '0')}`)
    m++
    if (m > 12) { m = 1; y++ }
  }
  return result
}
