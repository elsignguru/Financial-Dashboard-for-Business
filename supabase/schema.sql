-- ============================================================================
-- Grupo Filippo financial dashboard — QuickBooks Online sync schema
-- ----------------------------------------------------------------------------
-- Run this once in the Supabase SQL Editor (Dashboard -> SQL Editor -> New
-- query) on the DEDICATED Supabase project for this dashboard (do not run
-- against the TempSense project). Safe to re-run: every statement is guarded.
-- ============================================================================

-- ============================================================================
-- companies — one row per connected QuickBooks Online company/entity.
-- No secrets live here; safe for the `authenticated` role to read directly.
-- ============================================================================
create table if not exists public.companies (
  id               uuid primary key default gen_random_uuid(),
  qbo_realm_id     text not null unique,
  display_name     text not null,
  currency         text not null default 'CRC',
  status           text not null default 'connected'
                     check (status in ('connected', 'error', 'disconnected')),
  last_synced_at   timestamptz,
  last_sync_error  text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

alter table public.companies enable row level security;

drop policy if exists "companies read" on public.companies;
create policy "companies read"
  on public.companies
  for select
  to authenticated
  using (true);

-- Renaming a company (display_name) is safe for `authenticated` to do
-- directly — this table holds no secrets. Deleting a company goes through
-- /api/qbo/disconnect instead (service-role), since the cascade delete into
-- qbo_tokens would otherwise be blocked by that table's RLS.
drop policy if exists "companies rename" on public.companies;
create policy "companies rename"
  on public.companies
  for update
  to authenticated
  using (true)
  with check (true);

-- ============================================================================
-- qbo_tokens — OAuth credentials. RLS enabled with ZERO policies for
-- `authenticated`/`anon`, so this table is completely unreadable/unwritable
-- from the browser under any circumstance. Only the service-role key
-- (server-side in /api/qbo/*) can touch it, because service_role bypasses
-- RLS entirely.
-- ============================================================================
create table if not exists public.qbo_tokens (
  company_id                uuid primary key references public.companies(id) on delete cascade,
  access_token              text not null,
  access_token_expires_at   timestamptz not null,
  refresh_token             text not null,
  refresh_token_expires_at  timestamptz not null,
  updated_at                timestamptz not null default now()
);

alter table public.qbo_tokens enable row level security;
-- Intentionally no policies created for authenticated/anon.

-- ============================================================================
-- pnl_line_items — normalized P&L data: one row per company+metric+month.
-- Mirrors the frontend's MetricRow shape so it's a direct regroup, not a
-- transform, when loaded into the dashboard.
-- ============================================================================
create table if not exists public.pnl_line_items (
  id           bigint generated always as identity primary key,
  company_id   uuid not null references public.companies(id) on delete cascade,
  section      text not null default '',
  metric_name  text not null,
  row_type     text not null check (row_type in ('leaf', 'subtotal', 'summary')),
  period       text not null,            -- "YYYY-MM"
  value        numeric,                  -- null preserved (matches number|null)
  sort_order   integer not null default 0,
  synced_at    timestamptz not null default now(),
  unique (company_id, metric_name, period)
);

create index if not exists pnl_line_items_company_idx on public.pnl_line_items (company_id);

alter table public.pnl_line_items enable row level security;

drop policy if exists "pnl_line_items read" on public.pnl_line_items;
create policy "pnl_line_items read"
  on public.pnl_line_items
  for select
  to authenticated
  using (true);

-- No write policy for authenticated — only service_role writes, via upsert
-- on (company_id, metric_name, period) from the sync job.

-- Keep companies.updated_at fresh.
create or replace function public.companies_touch()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists companies_touch on public.companies;
create trigger companies_touch
  before update on public.companies
  for each row execute function public.companies_touch();
