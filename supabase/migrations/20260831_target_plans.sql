-- =====================================================================
-- Migration: Create target_plans table with RLS policies & performance indexes
-- Target Plan & Risk Management feature for TradePulse Gold
-- =====================================================================

create table if not exists public.target_plans (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references auth.users(id) on delete cascade,
  account_id          uuid references public.trading_accounts(id) on delete set null,
  name                text not null default 'Account Growth Plan ($50 ➔ $100)',
  starting_balance    numeric(14,2) not null default 50.00 check (starting_balance > 0),
  target_balance      numeric(14,2) not null default 100.00 check (target_balance > starting_balance),
  risk_per_trade_pct  numeric(5,2)  not null default 2.00 check (risk_per_trade_pct > 0 and risk_per_trade_pct <= 100),
  target_rr           numeric(5,2)  not null default 2.00 check (target_rr >= 1.0),
  max_daily_loss_pct  numeric(5,2)  not null default 4.00 check (max_daily_loss_pct > 0 and max_daily_loss_pct <= 100),
  drawdown_floor      numeric(14,2) not null default 40.00,
  max_open_trades     integer not null default 1 check (max_open_trades >= 1),
  milestone_stages    integer not null default 4 check (milestone_stages >= 2 and milestone_stages <= 10),
  rules               jsonb not null default '[
    {"id": "rule_risk", "text": "Never exceed the planned risk % on any single trade", "enabled": true},
    {"id": "rule_daily_stop", "text": "Stop trading immediately if daily loss limit is hit", "enabled": true},
    {"id": "rule_rr", "text": "Take setups with at least 1:2 Risk-to-Reward ratio", "enabled": true},
    {"id": "rule_no_revenge", "text": "Do not increase lot size or revenge trade after a loss", "enabled": true},
    {"id": "rule_one_pos", "text": "Maintain max 1 open position at a time on micro accounts", "enabled": true}
  ]'::jsonb,
  status              text not null default 'active' check (status in ('active', 'achieved', 'breached', 'paused')),
  is_active           boolean not null default true,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- Indices for performance
create index if not exists idx_target_plans_user_id on public.target_plans(user_id);
create index if not exists idx_target_plans_account_id on public.target_plans(account_id);
create index if not exists idx_target_plans_status on public.target_plans(status);

-- Enable Row Level Security (RLS)
alter table public.target_plans enable row level security;

-- RLS Policies (strictly per-user data isolation)
drop policy if exists "select_own_target_plans" on public.target_plans;
create policy "select_own_target_plans" on public.target_plans
  for select using (auth.uid() = user_id);

drop policy if exists "insert_own_target_plans" on public.target_plans;
create policy "insert_own_target_plans" on public.target_plans
  for insert with check (auth.uid() = user_id);

drop policy if exists "update_own_target_plans" on public.target_plans;
create policy "update_own_target_plans" on public.target_plans
  for update using (auth.uid() = user_id);

drop policy if exists "delete_own_target_plans" on public.target_plans;
create policy "delete_own_target_plans" on public.target_plans
  for delete using (auth.uid() = user_id);
