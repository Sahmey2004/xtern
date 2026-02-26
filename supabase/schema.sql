-- ============================================================
-- Supply Chain PO Automation — Supabase Schema
-- Run this entire file in Supabase SQL Editor
-- ============================================================

-- ─── PRODUCTS ────────────────────────────────────────────────
create table if not exists products (
  sku            text primary key,
  name           text not null,
  category       text not null,
  moq            int  not null default 1,
  unit_weight_kg numeric(10,4) not null,
  unit_cbm       numeric(10,6) not null,
  unit_price_usd numeric(10,2) not null,
  created_at     timestamptz default now()
);

-- ─── SUPPLIERS ───────────────────────────────────────────────
create table if not exists suppliers (
  id                   text primary key,
  name                 text not null,
  region               text,
  lead_time_days       int  not null,
  quality_score        int  not null,
  delivery_performance int  not null,
  cost_rating          int  not null,
  contact_email        text,
  created_at           timestamptz default now()
);

-- ─── SUPPLIER ↔ PRODUCT PRICING ──────────────────────────────
create table if not exists supplier_products (
  id          bigserial primary key,
  supplier_id text references suppliers(id) on delete cascade,
  sku         text references products(sku) on delete cascade,
  unit_price  numeric(10,2) not null,
  moq_override int,
  created_at  timestamptz default now(),
  unique(supplier_id, sku)
);

-- ─── DEMAND FORECASTS ────────────────────────────────────────
create table if not exists forecasts (
  id           bigserial primary key,
  sku          text references products(sku) on delete cascade,
  period       date not null,
  forecast_qty int  not null,
  actual_qty   int,
  created_at   timestamptz default now(),
  unique(sku, period)
);

-- ─── INVENTORY POSITIONS ─────────────────────────────────────
create table if not exists inventory (
  sku           text primary key references products(sku) on delete cascade,
  current_stock int not null default 0,
  in_transit    int not null default 0,
  safety_stock  int not null default 0,
  buffer_stock  int not null default 0,
  reorder_point int not null default 0,
  updated_at    timestamptz default now()
);

-- ─── CONTAINER SPECS ─────────────────────────────────────────
create table if not exists container_specs (
  type           text primary key,
  max_weight_kg  int  not null,
  max_cbm        numeric(8,2) not null,
  base_cost_usd  int  not null
);

-- ─── SUPPLIER SCORING WEIGHTS ────────────────────────────────
create table if not exists supplier_scoring_weights (
  category         text primary key,
  delivery_weight  numeric(4,2) not null,
  quality_weight   numeric(4,2) not null,
  lead_time_weight numeric(4,2) not null,
  cost_weight      numeric(4,2) not null
);

-- ─── PURCHASE ORDERS ─────────────────────────────────────────
create table if not exists purchase_orders (
  po_number      text primary key,
  status         text not null default 'draft'
                   check (status in ('draft','pending_approval','approved','rejected')),
  created_at     timestamptz default now(),
  created_by     text not null default 'system',
  approved_by    text,
  approved_at    timestamptz,
  total_usd      numeric(14,2),
  container_plan jsonb,
  notes          text,
  run_id         text
);

-- ─── PO LINE ITEMS ───────────────────────────────────────────
create table if not exists po_line_items (
  id          bigserial primary key,
  po_number   text references purchase_orders(po_number) on delete cascade,
  sku         text references products(sku),
  supplier_id text references suppliers(id),
  qty_ordered int  not null,
  unit_price  numeric(10,2) not null,
  total_price numeric(14,2) generated always as (qty_ordered * unit_price) stored,
  rationale   text,
  created_at  timestamptz default now()
);

-- ─── DECISION LOG ────────────────────────────────────────────
create table if not exists decision_log (
  id         bigserial primary key,
  run_id     text,
  po_number  text,
  agent_name text not null,
  timestamp  timestamptz default now(),
  inputs     jsonb,
  output     jsonb,
  confidence numeric(4,2),
  rationale  text
);

-- ─── INDEXES ─────────────────────────────────────────────────
create index if not exists idx_forecasts_sku     on forecasts(sku);
create index if not exists idx_forecasts_period  on forecasts(period);
create index if not exists idx_sp_supplier       on supplier_products(supplier_id);
create index if not exists idx_sp_sku            on supplier_products(sku);
create index if not exists idx_po_status         on purchase_orders(status);
create index if not exists idx_po_line_po        on po_line_items(po_number);
create index if not exists idx_dlog_run          on decision_log(run_id);
create index if not exists idx_dlog_agent        on decision_log(agent_name);

-- ─── ROW LEVEL SECURITY (DISABLE FOR SEEDING / DEMO) ────────
-- Disable RLS on all tables for the demo so the service role
-- and anon key can both read freely.
alter table products              disable row level security;
alter table suppliers             disable row level security;
alter table supplier_products     disable row level security;
alter table forecasts             disable row level security;
alter table inventory             disable row level security;
alter table container_specs       disable row level security;
alter table supplier_scoring_weights disable row level security;
alter table purchase_orders       disable row level security;
alter table po_line_items         disable row level security;
alter table decision_log          disable row level security;
