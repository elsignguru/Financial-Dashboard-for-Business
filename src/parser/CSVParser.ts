// Parses a QuickBooks-style Spanish-language P&L CSV into a ParsedReport.
// Expected format: first row has month headers ("enero 2024"), first column has metric names.
import Papa from 'papaparse'
import type { MetricRow, MetricRowType, ParsedReport } from '../types'

// ─── Month name lookup ──────────────────────────────────────────────────────────

const SPANISH_MONTHS: Record<string, number> = {
  // Full names
  enero: 1, febrero: 2, marzo: 3, abril: 4,
  mayo: 5, junio: 6, julio: 7, agosto: 8,
  septiembre: 9, octubre: 10, noviembre: 11, diciembre: 12,
  // Abbreviations (QuickBooks sometimes exports these)
  ene: 1, feb: 2, mar: 3, abr: 4,
  may: 5, jun: 6, jul: 7, ago: 8,
  sep: 9, oct: 10, nov: 11, dic: 12,
}

// Converts any recognisable Spanish month header → "YYYY-MM".
// Handles: "noviembre 2025", "Nov 2025", "noviembre-2025", "noviembre de 2025", "nov. 2025"
function parseMonthLabel(label: string): string | null {
  // Normalise: punctuation → space, collapse whitespace, lowercase
  const normalized = label.trim().toLowerCase()
    .replace(/[-/_.]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  let month: number | undefined
  let year: number | undefined

  for (const token of normalized.split(' ')) {
    if (token === 'de' || token === 'del') continue  // skip Spanish connectors
    const m = SPANISH_MONTHS[token]
    if (m !== undefined) { month = m; continue }
    // Accept a 4-digit year in the 2000-2099 range
    if (/^\d{4}$/.test(token)) {
      const y = parseInt(token)
      if (y >= 2000 && y <= 2099) year = y
    }
  }

  if (!month || !year) return null
  return `${year}-${String(month).padStart(2, '0')}`
}

// ─── Cell cleaning ──────────────────────────────────────────────────────────────

// Strips encoding artifacts (non-breaking spaces, garbled UTF-8 bytes) from raw CSV cells.
function cleanCell(raw: string): string {
  return raw
    .replace(/\xc2\xa0/g, ' ')
    .replace(/\xa0/g, ' ')
    .replace(/Â/g, '')
    .trim()
}

// ─── Numeric value parsing ──────────────────────────────────────────────────────

// Handles CRC-prefixed values ("CRC 1,234.56"), negative forms ("-CRC 500"),
// and thousands-separator commas. Returns null for empty or non-numeric cells.
function parseValue(raw: string): number | null {
  const cell = cleanCell(raw)
  if (!cell || cell === '0.00' && raw.trim() === '0.00') {
    if (!cell) return null
  }

  let s = cell
  let negative = false

  // Handle "-CRC 1234" form (minus before currency prefix)
  if (s.startsWith('-')) {
    const after = s.slice(1).trimStart()
    if (/^CRC/i.test(after)) {
      negative = true
      s = after
    }
  }

  // Strip CRC prefix
  s = s.replace(/^CRC\s*/i, '').trim()

  // Strip thousands-separator commas
  s = s.replace(/,/g, '')

  const num = parseFloat(s)
  if (isNaN(num)) return null
  return negative ? -num : num
}

// ─── Row classification ─────────────────────────────────────────────────────────

// Determines whether a row is a leaf metric, a subtotal, a key summary line,
// or a footer row (marks end of useful data).
function classifyRow(name: string): MetricRowType | 'header' | 'footer' {
  const lower = name.toLowerCase()
  if (lower.startsWith('accrual basis')) return 'footer'
  if (lower.startsWith('total para')) return 'subtotal'
  if (name === 'Beneficio bruto' || name === 'Net earnings') return 'summary'
  return 'leaf'
}

// ─── Main parse function ────────────────────────────────────────────────────────

// Accepts raw CSV text and the company name (set by the user at upload time).
// Returns a ParsedReport with all metric rows keyed by "YYYY-MM" date strings.
export function parseCSV(csvText: string, companyName: string): ParsedReport {
  const result = Papa.parse<string[]>(csvText, { skipEmptyLines: false })
  const rows = result.data

  if (rows.length < 2) throw new Error('CSV vacío o sin datos')

  // Parse date columns from header row
  const headerRow = rows[0]
  const dates: string[] = []
  const dateColIdx: number[] = []

  for (let i = 1; i < headerRow.length; i++) {
    const d = parseMonthLabel(cleanCell(headerRow[i] || ''))
    if (d) { dates.push(d); dateColIdx.push(i) }
  }

  if (dates.length === 0) throw new Error('No se encontraron columnas de fecha en el CSV')

  const metrics: MetricRow[] = []
  let currentSection = ''

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i]
    if (!row?.length) continue

    const name = cleanCell(row[0] || '')
    if (!name) continue

    const rowType = classifyRow(name)
    if (rowType === 'footer') break

    // Rows with no numeric data in any date column are section headers (e.g. "Ingresos").
    const allEmpty = dateColIdx.every(idx => !cleanCell(row[idx] || ''))
    if (allEmpty) {
      currentSection = name
      continue
    }

    if (rowType === 'header') continue  // shouldn't happen after allEmpty check

    // Parse numeric values
    const data: Record<string, number | null> = {}
    for (let j = 0; j < dates.length; j++) {
      data[dates[j]] = parseValue(row[dateColIdx[j]] || '')
    }

    metrics.push({ name, section: currentSection, type: rowType as MetricRowType, data })
  }

  return { companyName, currency: 'CRC', dates, metrics }
}
