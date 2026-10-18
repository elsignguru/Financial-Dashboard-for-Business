// Transforms a QuickBooks Online ProfitAndLoss Reports API JSON payload into
// flat (metric, period, value) rows ready to upsert into pnl_line_items.
// Reference: https://developer.intuit.com/app/developer/qbo/docs/api/accounting/all-entities/reports

export interface PnlRow {
  section: string
  metricName: string
  rowType: 'leaf' | 'subtotal' | 'summary'
  period: string // "YYYY-MM"
  value: number | null
  sortOrder: number
}

interface QboColumn {
  ColTitle?: string
  ColType?: string
  MetaData?: { Name: string; Value: string }[]
}

interface QboColData {
  value?: string
}

interface QboRow {
  type?: string
  group?: string
  Header?: { ColData?: QboColData[] }
  Summary?: { ColData?: QboColData[] }
  Rows?: { Row?: QboRow[] }
  ColData?: QboColData[]
}

interface QboReport {
  Columns?: { Column?: QboColumn[] }
  Rows?: { Row?: QboRow[] }
}

const SUMMARY_GROUPS = new Set(['GrossProfit', 'NetIncome', 'NetOperatingIncome'])

function parseValue(raw: string | undefined): number | null {
  if (raw === undefined || raw === '') return null
  const n = Number(raw)
  return Number.isNaN(n) ? null : n
}

// Maps each data column index -> "YYYY-MM", skipping the label column (index 0)
// and a trailing "Total"/no-MetaData column. Uses the StartDate MetaData QBO
// attaches to each month column rather than parsing ColTitle text — avoids the
// locale-dependent month-name parsing the old CSV importer needed.
function mapColumnsToPeriods(columns: QboColumn[]): (string | null)[] {
  return columns.map(col => {
    const startDate = col.MetaData?.find(m => m.Name === 'StartDate')?.Value
    if (!startDate) return null // label column or trailing "Total" column
    return startDate.slice(0, 7) // "YYYY-MM-DD" -> "YYYY-MM"
  })
}

function emitRow(
  out: PnlRow[],
  colData: QboColData[] | undefined,
  periods: (string | null)[],
  section: string,
  rowType: PnlRow['rowType'],
  sortOrder: number,
) {
  if (!colData?.length) return
  const metricName = colData[0]?.value?.trim()
  if (!metricName) return

  for (let i = 1; i < colData.length; i++) {
    const period = periods[i]
    if (!period) continue // skip the trailing "Total" column
    out.push({
      section,
      metricName,
      rowType,
      period,
      value: parseValue(colData[i]?.value),
      sortOrder,
    })
  }
}

function walk(rows: QboRow[], periods: (string | null)[], section: string, out: PnlRow[], counter: { n: number }) {
  for (const row of rows) {
    counter.n += 1

    if (row.type === 'Data') {
      emitRow(out, row.ColData, periods, section, 'leaf', counter.n)
      continue
    }

    if (row.type === 'Section') {
      const label = row.Header?.ColData?.[0]?.value?.trim()
      const childSection = label || section

      if (row.Rows?.Row?.length) {
        walk(row.Rows.Row, periods, childSection, out, counter)
      }

      if (row.Summary?.ColData?.length) {
        const rowType: PnlRow['rowType'] = row.group && SUMMARY_GROUPS.has(row.group) ? 'summary' : 'subtotal'
        emitRow(out, row.Summary.ColData, periods, section, rowType, counter.n)
      }
    }
  }
}

export function transformProfitAndLoss(report: QboReport): PnlRow[] {
  const columns = report.Columns?.Column ?? []
  const periods = mapColumnsToPeriods(columns)
  const rows = report.Rows?.Row ?? []

  const out: PnlRow[] = []
  walk(rows, periods, '', out, { n: 0 })
  return out
}
