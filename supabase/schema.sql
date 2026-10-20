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

-- QuickBooks realm ids are always numeric — rejects a malformed value before
-- it's ever used to build a request path in qboClient.ts.
alter table public.companies drop constraint if exists companies_qbo_realm_id_numeric;
alter table public.companies add constraint companies_qbo_realm_id_numeric check (qbo_realm_id ~ '^[0-9]+$');

alter table public.companies enable row level security;

drop policy if exists "companies read" on public.companies;
create policy "companies read"
  on public.companies
  for select
  to authenticated
  using (true);

-- Renaming a company is safe for `authenticated` to do directly — this
-- table holds no secrets — but RLS alone only filters which ROWS a
-- statement can touch, not which COLUMNS it can set. Without the column
-- grant below, an authenticated client could update ANY column on this
-- table (qbo_realm_id, status, last_sync_error, ...), not just display_name.
revoke update on public.companies from authenticated;
grant update (display_name) on public.companies to authenticated;

drop policy if exists "companies rename" on public.companies;
create policy "companies rename"
  on public.companies
  for update
  to authenticated
  using (true)
  with check (true);

-- Deleting a company goes through /api/qbo/disconnect (service-role)
-- instead of a client-side delete policy: `authenticated` is never granted
-- DELETE here at all, and that endpoint also makes sure disconnecting one
-- company can't be triggered by anyone other than a logged-in user.

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
  synced_at    timestamptz not null default now()
);

create index if not exists pnl_line_items_company_idx on public.pnl_line_items (company_id);

-- Keyed on (company, SECTION, metric, period) rather than just (company,
-- metric, period) — QuickBooks can have two identically-named leaf accounts
-- under different sections (e.g. "Salarios" under both Costo de ventas and
-- Gastos), which would otherwise collide here and break every sync for that
-- company with a Postgres upsert conflict error. Explicit drop-then-add
-- (rather than an inline `unique(...)` on the table) so re-running this
-- script also migrates a database that already had the narrower constraint.
alter table public.pnl_line_items drop constraint if exists pnl_line_items_company_id_metric_name_period_key;
alter table public.pnl_line_items drop constraint if exists pnl_line_items_company_id_section_metric_name_period_key;
alter table public.pnl_line_items add constraint pnl_line_items_company_id_section_metric_name_period_key
  unique (company_id, section, metric_name, period);

alter table public.pnl_line_items enable row level security;

drop policy if exists "pnl_line_items read" on public.pnl_line_items;
create policy "pnl_line_items read"
  on public.pnl_line_items
  for select
  to authenticated
  using (true);

-- No write policy for authenticated — only service_role writes, via upsert
-- on (company_id, section, metric_name, period) from the sync job.

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

-- ============================================================================
-- dashboard_config — the shared dashboard layout (chart cards + derived
-- metrics), stored as a single singleton row (id = 1). Every signed-in
-- device loads this row on page load and writes it back ~1s after any edit,
-- so every invited user sees the same charts regardless of which device or
-- session created them — same singleton-row pattern as the TempSense
-- dashboard's own dashboard_config table.
-- ============================================================================
create table if not exists public.dashboard_config (
  id               smallint    primary key default 1,
  plots            jsonb       not null default '[]'::jsonb,
  derived_metrics  jsonb       not null default '[]'::jsonb,
  updated_at       timestamptz not null default now(),
  constraint dashboard_config_singleton check (id = 1)
);

alter table public.dashboard_config enable row level security;

drop policy if exists "dashboard_config read" on public.dashboard_config;
create policy "dashboard_config read"
  on public.dashboard_config
  for select
  to authenticated
  using (true);

drop policy if exists "dashboard_config insert" on public.dashboard_config;
create policy "dashboard_config insert"
  on public.dashboard_config
  for insert
  to authenticated
  with check (id = 1);

drop policy if exists "dashboard_config update" on public.dashboard_config;
create policy "dashboard_config update"
  on public.dashboard_config
  for update
  to authenticated
  using (id = 1)
  with check (id = 1);

-- No delete policy — the singleton row is never removed, only overwritten.

create or replace function public.dashboard_config_touch()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists dashboard_config_touch on public.dashboard_config;
create trigger dashboard_config_touch
  before update on public.dashboard_config
  for each row execute function public.dashboard_config_touch();
