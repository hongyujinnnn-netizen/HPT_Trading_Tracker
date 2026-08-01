-- =====================================================================
-- MPT / TradePulse Gold — Trading Journal & Signal Tracker
-- PostgreSQL schema (Supabase-ready: uses auth.users + Row Level Security)
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0. Extensions
-- ---------------------------------------------------------------------
create extension if not exists "pgcrypto";   -- gen_random_uuid()

-- ---------------------------------------------------------------------
-- 1. Enums
-- ---------------------------------------------------------------------
do $$ begin
    create type trade_side as enum ('buy', 'sell');
exception
    when duplicate_object then null;
end $$;

do $$ begin
    create type trade_status as enum ('open', 'closed');
exception
    when duplicate_object then null;
end $$;

do $$ begin
    create type market_condition as enum ('trending', 'ranging', 'volatile', 'news_driven', 'quiet');
exception
    when duplicate_object then null;
end $$;

do $$ begin
    create type emotion_tag as enum ('planned', 'emotional', 'revenge_trade', 'late_entry', 'overtrading', 'fomo', 'disciplined');
exception
    when duplicate_object then null;
end $$;

do $$ begin
    create type news_impact as enum ('low', 'medium', 'high');
exception
    when duplicate_object then null;
end $$;

do $$ begin
    create type import_source as enum ('mt4', 'mt5', 'custom_csv');
exception
    when duplicate_object then null;
end $$;

-- ---------------------------------------------------------------------
-- 2. user_settings  (1:1 with auth.users) — powers Settings + Risk Calculator
-- ---------------------------------------------------------------------
create table if not exists public.user_settings (
  user_id                uuid primary key references auth.users(id) on delete cascade,
  display_name           text,
  account_balance        numeric(14,2) not null default 10000,
  base_currency          text not null default 'USD',
  default_risk_pct       numeric(5,2)  not null default 1.00 check (default_risk_pct > 0 and default_risk_pct <= 100),
  contract_size          numeric(10,2) not null default 100,   -- XAU/USD: $ per 1.00 price point per 1 standard lot
  session_timezone       text not null default 'Asia/Phnom_Penh',
  csv_import_format      import_source not null default 'mt5',
  email_alerts_enabled   boolean not null default true,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 3. strategies — Strategy Comparison page
-- ---------------------------------------------------------------------
create table if not exists public.strategies (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text not null,
  description text,
  color_hex   text not null default '#C9A227',
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  unique (user_id, name)
);

-- ---------------------------------------------------------------------
-- 4. sessions — reference table for Session Performance strip
-- ---------------------------------------------------------------------
create table if not exists public.sessions (
  id            smallint primary key,
  name          text not null unique,
  start_time_utc time not null,
  end_time_utc   time not null,
  sort_order    smallint not null
);

insert into public.sessions (id, name, start_time_utc, end_time_utc, sort_order) values
  (1, 'Asian',         '00:00', '08:00', 1),
  (2, 'London',        '08:00', '16:00', 2),
  (3, 'New York',       '13:00', '21:00', 3),
  (4, 'London Close',   '16:00', '17:00', 4)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------
-- 5. trades — the core journal entry
-- ---------------------------------------------------------------------
create table if not exists public.trades (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,

  symbol           text not null default 'XAUUSD',
  side             trade_side not null,
  status           trade_status not null default 'closed',

  entry_price      numeric(10,3) not null,
  exit_price       numeric(10,3),                 -- null while status = 'open'
  lot_size         numeric(8,2) not null check (lot_size > 0),
  stop_loss        numeric(10,3),
  take_profit      numeric(10,3),

  entry_time       timestamptz not null,
  exit_time        timestamptz,

  strategy_id      uuid references public.strategies(id) on delete set null,
  session_id       smallint references public.sessions(id),
  market_condition market_condition,
  emotion          emotion_tag not null default 'planned',

  reason_for_entry text,
  notes            text,

  risk_amount      numeric(14,2),   -- $ risked = |entry - stop| * lot_size * contract_size
  pnl              numeric(14,2),   -- realized $ P&L (null while open)
  rr_ratio         numeric(6,2),    -- realized reward:risk (null while open or no stop)

  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),

  constraint chk_closed_has_exit check (
    status = 'open' or (exit_price is not null and exit_time is not null)
  )
);

create index if not exists idx_trades_user_time   on public.trades (user_id, entry_time desc);
create index if not exists idx_trades_strategy    on public.trades (strategy_id);
create index if not exists idx_trades_session     on public.trades (session_id);
create index if not exists idx_trades_emotion     on public.trades (emotion);

-- ---------------------------------------------------------------------
-- 6. trade_screenshots — chart images attached to a trade
-- ---------------------------------------------------------------------
create table if not exists public.trade_screenshots (
  id           uuid primary key default gen_random_uuid(),
  trade_id     uuid not null references public.trades(id) on delete cascade,
  storage_path text not null,     -- e.g. '{user_id}/{trade_id}/entry.png'
  caption      text,
  created_at   timestamptz not null default now()
);

create index if not exists idx_screenshots_trade on public.trade_screenshots (trade_id);

-- ---------------------------------------------------------------------
-- 7. mistake_types — fixed vocabulary
-- ---------------------------------------------------------------------
create table if not exists public.mistake_types (
  id          smallint primary key,
  code        text not null unique,
  label       text not null,
  description text not null
);

insert into public.mistake_types (id, code, label, description) values
  (1, 'no_stop_loss',   'No Stop Loss',     'Trade closed or logged without a stop loss price set.'),
  (2, 'overtrading',    'Overtrading',      'More trades opened in a short window than the user''s normal pace.'),
  (3, 'news_gambling',  'News Gambling',    'Entry placed within minutes of a high-impact economic event.'),
  (4, 'late_entry',     'Late Entry',       'Entry price far from the stated strategy trigger, or realized RR < 1.0.'),
  (5, 'revenge_trade',  'Revenge Trade',    'Re-entry shortly after a loss with an increased lot size.')
on conflict (id) do nothing;

-- ---------------------------------------------------------------------
-- 8. trade_mistakes — junction table
-- ---------------------------------------------------------------------
create table if not exists public.trade_mistakes (
  id              uuid primary key default gen_random_uuid(),
  trade_id        uuid not null references public.trades(id) on delete cascade,
  mistake_type_id smallint not null references public.mistake_types(id),
  auto_detected   boolean not null default true,
  rule_detail     jsonb,
  detected_at     timestamptz not null default now(),
  unique (trade_id, mistake_type_id)
);

create index if not exists idx_mistakes_trade on public.trade_mistakes (trade_id);
create index if not exists idx_mistakes_type  on public.trade_mistakes (mistake_type_id);

-- ---------------------------------------------------------------------
-- 9. economic_events — Market News / gold calendar
-- ---------------------------------------------------------------------
create table if not exists public.economic_events (
  id          uuid primary key default gen_random_uuid(),
  event_time  timestamptz not null,
  title       text not null,
  currency    text not null default 'USD',
  impact      news_impact not null,
  note        text,
  created_at  timestamptz not null default now()
);

create index if not exists idx_events_time on public.economic_events (event_time);

-- ---------------------------------------------------------------------
-- 10. price_snapshots — spot-price / spread / volatility history
-- ---------------------------------------------------------------------
create table if not exists public.price_snapshots (
  id               bigint generated always as identity primary key,
  symbol           text not null default 'XAUUSD',
  price            numeric(10,3) not null,
  spread           numeric(6,3),
  volatility_level text,
  captured_at      timestamptz not null default now()
);

create index if not exists idx_price_snapshots_time on public.price_snapshots (symbol, captured_at desc);

-- ---------------------------------------------------------------------
-- 11. csv_imports — audit log
-- ---------------------------------------------------------------------
create table if not exists public.csv_imports (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  source_format   import_source not null,
  file_name       text,
  rows_imported   integer not null default 0,
  rows_skipped    integer not null default 0,
  error_log       jsonb,
  created_at      timestamptz not null default now()
);

-- =====================================================================
-- 12. Trigger: auto-calculate trade metrics (Pinned search_path security)
-- =====================================================================
create or replace function public.trg_calculate_trade_metrics()
returns trigger
security definer
set search_path = public, pg_temp
as $$
declare
  v_contract_size numeric(10,2);
begin
  select contract_size into v_contract_size
  from public.user_settings
  where user_id = new.user_id;

  v_contract_size := coalesce(v_contract_size, 100);

  if new.stop_loss is not null then
    new.risk_amount := abs(new.entry_price - new.stop_loss) * new.lot_size * v_contract_size;
  else
    new.risk_amount := null;
  end if;

  if new.status = 'closed' and new.exit_price is not null then
    if new.side = 'buy' then
      new.pnl := (new.exit_price - new.entry_price) * new.lot_size * v_contract_size;
    else
      new.pnl := (new.entry_price - new.exit_price) * new.lot_size * v_contract_size;
    end if;
  else
    new.pnl := null;
  end if;

  if new.pnl is not null and new.risk_amount is not null and new.risk_amount > 0 then
    new.rr_ratio := round(new.pnl / new.risk_amount, 2);
  else
    new.rr_ratio := null;
  end if;

  new.updated_at := now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trades_calculate_metrics on public.trades;
create trigger trades_calculate_metrics
before insert or update on public.trades
for each row execute function public.trg_calculate_trade_metrics();

-- =====================================================================
-- 13. Trigger: auto-run Mistake Detector (Pinned search_path security)
-- =====================================================================
create or replace function public.trg_detect_mistakes()
returns trigger
security definer
set search_path = public, pg_temp
as $$
declare
  v_prior_loss_trade record;
  v_recent_trade_count integer;
  v_nearby_event record;
begin
  delete from public.trade_mistakes
  where trade_id = new.id and auto_detected = true;

  -- No Stop Loss
  if new.stop_loss is null then
    insert into public.trade_mistakes (trade_id, mistake_type_id, rule_detail)
    values (new.id, 1, jsonb_build_object('stop_loss', new.stop_loss))
    on conflict (trade_id, mistake_type_id) do nothing;
  end if;

  -- Late Entry
  if new.status = 'closed' and new.rr_ratio is not null and new.rr_ratio < 1.0 then
    insert into public.trade_mistakes (trade_id, mistake_type_id, rule_detail)
    values (new.id, 4, jsonb_build_object('rr_ratio', new.rr_ratio))
    on conflict (trade_id, mistake_type_id) do nothing;
  end if;

  -- Revenge Trade
  select * into v_prior_loss_trade
  from public.trades
  where user_id = new.user_id
    and id <> new.id
    and status = 'closed'
    and pnl < 0
    and exit_time is not null
    and new.entry_time - exit_time <= interval '15 minutes'
    and new.entry_time > exit_time
  order by exit_time desc
  limit 1;

  if found and new.lot_size >= v_prior_loss_trade.lot_size then
    insert into public.trade_mistakes (trade_id, mistake_type_id, rule_detail)
    values (new.id, 5, jsonb_build_object(
      'minutes_since_last_loss', extract(epoch from (new.entry_time - v_prior_loss_trade.exit_time)) / 60,
      'lot_increase_pct', round(((new.lot_size - v_prior_loss_trade.lot_size) / v_prior_loss_trade.lot_size) * 100, 1)
    ))
    on conflict (trade_id, mistake_type_id) do nothing;
  end if;

  -- Overtrading
  select count(*) into v_recent_trade_count
  from public.trades
  where user_id = new.user_id
    and id <> new.id
    and entry_time between new.entry_time - interval '60 minutes' and new.entry_time;

  if v_recent_trade_count >= 2 then
    insert into public.trade_mistakes (trade_id, mistake_type_id, rule_detail)
    values (new.id, 2, jsonb_build_object('trades_in_prior_60_min', v_recent_trade_count))
    on conflict (trade_id, mistake_type_id) do nothing;
  end if;

  -- News Gambling
  select * into v_nearby_event
  from public.economic_events
  where impact = 'high'
    and abs(extract(epoch from (new.entry_time - event_time))) <= 15 * 60
  order by abs(extract(epoch from (new.entry_time - event_time)))
  limit 1;

  if found then
    insert into public.trade_mistakes (trade_id, mistake_type_id, rule_detail)
    values (new.id, 3, jsonb_build_object(
      'event', v_nearby_event.title,
      'minutes_from_event', round(extract(epoch from (new.entry_time - v_nearby_event.event_time)) / 60, 1)
    ))
    on conflict (trade_id, mistake_type_id) do nothing;
  end if;

  return new;
end;
$$ language plpgsql;

drop trigger if exists trades_detect_mistakes on public.trades;
create trigger trades_detect_mistakes
after insert or update on public.trades
for each row execute function public.trg_detect_mistakes();

-- =====================================================================
-- 14. Auto-Provisioning Trigger on auth.users Signup
-- =====================================================================
create or replace function public.handle_new_user()
returns trigger
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.user_settings (user_id) values (new.id)
  on conflict (user_id) do nothing;

  insert into public.strategies (user_id, name, color_hex) values
    (new.id, 'Breakout',     '#3FA88C'),
    (new.id, 'Pullback',     '#C9A227'),
    (new.id, 'News Trading', '#C1502E')
  on conflict (user_id, name) do nothing;

  return new;
end;
$$ language plpgsql;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =====================================================================
-- 15. Row Level Security Policies
-- =====================================================================
alter table public.user_settings     enable row level security;
alter table public.strategies        enable row level security;
alter table public.trades            enable row level security;
alter table public.trade_screenshots enable row level security;
alter table public.trade_mistakes    enable row level security;
alter table public.csv_imports       enable row level security;

drop policy if exists "own settings" on public.user_settings;
create policy "own settings"   on public.user_settings   for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own strategies" on public.strategies;
create policy "own strategies" on public.strategies       for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own trades" on public.trades;
create policy "own trades"     on public.trades           for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own imports" on public.csv_imports;
create policy "own imports"    on public.csv_imports       for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own screenshots" on public.trade_screenshots;
create policy "own screenshots" on public.trade_screenshots for all using (
  exists (select 1 from public.trades t where t.id = trade_id and t.user_id = auth.uid())
) with check (
  exists (select 1 from public.trades t where t.id = trade_id and t.user_id = auth.uid())
);

drop policy if exists "own trade mistakes" on public.trade_mistakes;
create policy "own trade mistakes" on public.trade_mistakes for all using (
  exists (select 1 from public.trades t where t.id = trade_id and t.user_id = auth.uid())
) with check (
  exists (select 1 from public.trades t where t.id = trade_id and t.user_id = auth.uid())
);

-- Storage bucket security policy for chart screenshots
do $$ begin
  insert into storage.buckets (id, name, public) values ('trade-screenshots', 'trade-screenshots', false)
  on conflict (id) do nothing;
exception
  when undefined_table then null;
end $$;

do $$ begin
  drop policy if exists "own screenshots storage" on storage.objects;
  create policy "own screenshots storage" on storage.objects for all
    using (bucket_id = 'trade-screenshots' and (storage.foldername(name))[1] = auth.uid()::text)
    with check (bucket_id = 'trade-screenshots' and (storage.foldername(name))[1] = auth.uid()::text);
exception
  when undefined_table then null;
end $$;

-- Shared reference data policies
alter table public.sessions        enable row level security;
alter table public.mistake_types   enable row level security;
alter table public.economic_events enable row level security;
alter table public.price_snapshots enable row level security;

drop policy if exists "read sessions" on public.sessions;
create policy "read sessions"        on public.sessions        for select using (true);

drop policy if exists "read mistake_types" on public.mistake_types;
create policy "read mistake_types"   on public.mistake_types   for select using (true);

drop policy if exists "read economic_events" on public.economic_events;
create policy "read economic_events" on public.economic_events for select using (true);

drop policy if exists "read price_snapshots" on public.price_snapshots;
create policy "read price_snapshots" on public.price_snapshots for select using (true);

-- =====================================================================
-- 16. Views (Explicit security_invoker = true to enforce RLS!)
-- =====================================================================

create or replace view public.view_dashboard_stats
with (security_invoker = true) as
select
  t.user_id,
  count(*) filter (where t.status = 'closed')                         as closed_trades,
  coalesce(sum(t.pnl), 0)                                              as total_pnl,
  round(
    100.0 * count(*) filter (where t.status = 'closed' and t.pnl > 0)
    / nullif(count(*) filter (where t.status = 'closed'), 0)
  , 1)                                                                 as win_rate_pct,
  round(avg(t.rr_ratio) filter (where t.status = 'closed'), 2)         as avg_rr_ratio,
  max(t.pnl)                                                           as best_trade_pnl,
  min(t.pnl)                                                           as worst_trade_pnl
from public.trades t
group by t.user_id;

create or replace view public.view_equity_curve
with (security_invoker = true) as
select
  t.user_id,
  t.exit_time,
  us.account_balance + sum(t.pnl) over (
    partition by t.user_id order by t.exit_time
    rows between unbounded preceding and current row
  ) as running_balance
from public.trades t
join public.user_settings us on us.user_id = t.user_id
where t.status = 'closed'
order by t.user_id, t.exit_time;

create or replace view public.view_session_performance
with (security_invoker = true) as
select
  t.user_id,
  s.id   as session_id,
  s.name as session_name,
  count(*)                                                           as trade_count,
  round(100.0 * count(*) filter (where t.pnl > 0) / count(*), 1)      as win_rate_pct,
  coalesce(sum(t.pnl), 0)                                             as total_pnl
from public.trades t
join public.sessions s on s.id = t.session_id
where t.status = 'closed'
group by t.user_id, s.id, s.name;

create or replace view public.view_strategy_performance
with (security_invoker = true) as
select
  t.user_id,
  st.id   as strategy_id,
  st.name as strategy_name,
  count(*)                                                           as trade_count,
  round(100.0 * count(*) filter (where t.pnl > 0) / count(*), 1)      as win_rate_pct,
  round(avg(t.rr_ratio), 2)                                           as avg_rr_ratio,
  coalesce(sum(t.pnl), 0)                                             as total_pnl
from public.trades t
join public.strategies st on st.id = t.strategy_id
where t.status = 'closed'
group by t.user_id, st.id, st.name;

create or replace view public.view_mistake_cost
with (security_invoker = true) as
select
  t.user_id,
  mt.code,
  mt.label,
  count(*)             as occurrences,
  coalesce(sum(t.pnl), 0) as total_pnl_impact
from public.trade_mistakes tm
join public.trades t on t.id = tm.trade_id
join public.mistake_types mt on mt.id = tm.mistake_type_id
where t.status = 'closed'
group by t.user_id, mt.code, mt.label;

-- Enforce security_invoker = true explicitly for Postgres 15+
alter view public.view_dashboard_stats      set (security_invoker = true);
alter view public.view_equity_curve         set (security_invoker = true);
alter view public.view_session_performance  set (security_invoker = true);
alter view public.view_strategy_performance set (security_invoker = true);
alter view public.view_mistake_cost         set (security_invoker = true);
