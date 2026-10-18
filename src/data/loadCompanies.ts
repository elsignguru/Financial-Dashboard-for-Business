// Fetches companies + their P&L line items from Supabase and regroups them
// into the exact Company[]/ParsedReport/MetricRow[] shape CSVParser.ts used
// to produce, so resolveMetric.ts, ChartContainer.tsx, MetricSelector.tsx
// etc. need zero changes — only how the data arrives changed, not its shape.
import { supabase } from '../lib/supabaseClient'
import { useDataStore } from '../store/useDataStore'
import type { Company, MetricRow, MetricRowType } from '../types'

interface MetricAccumulator {
  section: string
  type: MetricRowType
  sortOrder: number
  syncedAt: string
  data: Record<string, number | null>
}

export async function loadCompanies(): Promise<void> {
  const [companiesRes, lineItemsRes] = await Promise.all([
    supabase.from('companies').select('*').order('display_name'),
    supabase.from('pnl_line_items').select('*'),
  ])

  if (companiesRes.error) throw new Error(companiesRes.error.message)
  if (lineItemsRes.error) throw new Error(lineItemsRes.error.message)

  const rowsByCompany = new Map<string, typeof lineItemsRes.data>()
  for (const row of lineItemsRes.data ?? []) {
    const companyId = row.company_id as string
    const list = rowsByCompany.get(companyId) ?? []
    list.push(row)
    rowsByCompany.set(companyId, list)
  }

  const companies: Company[] = (companiesRes.data ?? []).map(c => {
    const rows = rowsByCompany.get(c.id as string) ?? []
    const metricsByName = new Map<string, MetricAccumulator>()

    for (const row of rows) {
      const name = row.metric_name as string
      const syncedAt = row.synced_at as string

      let entry = metricsByName.get(name)
      if (!entry) {
        entry = { section: row.section as string, type: row.row_type as MetricRowType, sortOrder: row.sort_order as number, syncedAt, data: {} }
        metricsByName.set(name, entry)
      }

      entry.data[row.period as string] = row.value === null ? null : Number(row.value)

      // Metadata (section/type/order) always reflects the most recently
      // synced row, so the UI self-heals if QBO reorganizes the report.
      if (syncedAt > entry.syncedAt) {
        entry.section = row.section as string
        entry.type = row.row_type as MetricRowType
        entry.sortOrder = row.sort_order as number
        entry.syncedAt = syncedAt
      }
    }

    const metrics: MetricRow[] = Array.from(metricsByName.entries())
      .sort((a, b) => a[1].sortOrder - b[1].sortOrder)
      .map(([name, m]) => ({ name, section: m.section, type: m.type, data: m.data }))

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
