// Fetches companies + their P&L line items from Supabase and regroups them
// into the exact Company[]/ParsedReport/MetricRow[] shape CSVParser.ts used
// to produce, so resolveMetric.ts, ChartContainer.tsx, MetricSelector.tsx
// etc. need zero changes — only how the data arrives changed, not its shape.
import { supabase } from '../lib/supabaseClient'
import { useDataStore } from '../store/useDataStore'
import type { Company, MetricRow, MetricRowType } from '../types'

interface MetricAccumulator {
  name: string
  section: string
  type: MetricRowType
  sortOrder: number
  syncedAt: string
  data: Record<string, number | null>
}

// Supabase/PostgREST caps every response at 1000 rows regardless of query —
// a company with full history easily exceeds that, so page through with
// .range() until a short page comes back (same pattern used in the
// TempSense dashboard's Supabase reads).
async function fetchAllLineItems() {
  const pageSize = 1000
  const all: NonNullable<Awaited<ReturnType<typeof fetchPage>>['data']> = []
  let from = 0

  function fetchPage(rangeFrom: number, rangeTo: number) {
    return supabase.from('pnl_line_items').select('*').order('id', { ascending: true }).range(rangeFrom, rangeTo)
  }

  while (true) {
    const { data, error } = await fetchPage(from, from + pageSize - 1)
    if (error) throw new Error(error.message)
    if (!data || data.length === 0) break
    all.push(...data)
    if (data.length < pageSize) break
    from += pageSize
  }

  return all
}

export async function loadCompanies(): Promise<void> {
  const [companiesRes, lineItems] = await Promise.all([
    supabase.from('companies').select('*').order('display_name'),
    fetchAllLineItems(),
  ])

  if (companiesRes.error) throw new Error(companiesRes.error.message)

  const rowsByCompany = new Map<string, typeof lineItems>()
  for (const row of lineItems) {
    const companyId = row.company_id as string
    const list = rowsByCompany.get(companyId) ?? []
    list.push(row)
    rowsByCompany.set(companyId, list)
  }

  const companies: Company[] = (companiesRes.data ?? []).map(c => {
    const rows = rowsByCompany.get(c.id as string) ?? []
    // Keyed by section+name, not name alone — QuickBooks can have two
    // identically-named leaf accounts under different sections (e.g.
    // "Salarios" under both Costo de ventas and Gastos), which would
    // otherwise silently collapse into one metric here.
    const metricsByKey = new Map<string, MetricAccumulator>()

    for (const row of rows) {
      const name = row.metric_name as string
      const section = row.section as string
      const syncedAt = row.synced_at as string
      const key = `${section}::${name}`

      let entry = metricsByKey.get(key)
      if (!entry) {
        entry = { name, section, type: row.row_type as MetricRowType, sortOrder: row.sort_order as number, syncedAt, data: {} }
        metricsByKey.set(key, entry)
      }

      entry.data[row.period as string] = row.value === null ? null : Number(row.value)

      // Metadata (type/order) always reflects the most recently synced row,
      // so the UI self-heals if QBO reorganizes the report.
      if (syncedAt > entry.syncedAt) {
        entry.type = row.row_type as MetricRowType
        entry.sortOrder = row.sort_order as number
        entry.syncedAt = syncedAt
      }
    }

    const metrics: MetricRow[] = Array.from(metricsByKey.values())
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map(m => ({ name: m.name, section: m.section, type: m.type, data: m.data }))

    const dates = Array.from(new Set(rows.map(r => r.period as string))).sort()

    return {
      id: c.id as string,
      name: c.display_name as string,
      report: {
        companyName: c.display_name as string,
        currency: c.currency as string,
        dates,
        metrics,
      },
      qboStatus: c.status as Company['qboStatus'],
      lastSyncedAt: c.last_synced_at as string | null,
      lastSyncError: c.last_sync_error as string | null,
    }
  })

  useDataStore.getState().setCompanies(companies)
}
