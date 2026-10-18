// Hand-written types mirroring supabase/schema.sql — just enough structure
// for supabase-js to type-check reads/writes in the serverless functions.
// (Not generated via the Supabase CLI; keep these in sync with schema.sql by hand.)
//
// NOTE: these must be `type` object literals, not `interface`s — postgrest-js
// constrains Row/Insert/Update to `Record<string, unknown>`, which a plain
// `interface` (lacking an index signature) does not structurally satisfy,
// while an object type literal does.

export type CompanyRow = {
  id: string
  qbo_realm_id: string
  display_name: string
  currency: string
  status: 'connected' | 'error' | 'disconnected'
  last_synced_at: string | null
  last_sync_error: string | null
  created_at: string
  updated_at: string
}

export type QboTokenRow = {
  company_id: string
  access_token: string
  access_token_expires_at: string
  refresh_token: string
  refresh_token_expires_at: string
  updated_at: string
}

export type PnlLineItemRow = {
  id: number
  company_id: string
  section: string
  metric_name: string
  row_type: 'leaf' | 'subtotal' | 'summary'
  period: string
  value: number | null
  sort_order: number
  synced_at: string
}

type TableDef<Row, Insert> = { Row: Row; Insert: Insert; Update: Partial<Insert>; Relationships: [] }

// Fields with a DB default or that are nullable can be omitted on insert/upsert.
type CompanyInsert = Pick<CompanyRow, 'qbo_realm_id' | 'display_name'>
  & Partial<Pick<CompanyRow, 'id' | 'currency' | 'status' | 'last_synced_at' | 'last_sync_error' | 'created_at' | 'updated_at'>>

export type Database = {
  public: {
    Tables: {
      companies: TableDef<CompanyRow, CompanyInsert>
      qbo_tokens: TableDef<QboTokenRow, QboTokenRow>
      pnl_line_items: TableDef<PnlLineItemRow, Omit<PnlLineItemRow, 'id'>>
    }
    Views: Record<string, never>
    Functions: Record<string, never>
  }
}
