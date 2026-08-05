-- Migration: Create crt_setups table with RLS policies
create table if not exists public.crt_setups (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  symbol text not null default 'XAUUSD',
  timeframe text not null default '4h',
  detected_at timestamptz not null,
  sweep_candle jsonb not null,
  direction text check (direction in ('long','short')) not null,
  entry_price numeric not null,
  stop_price numeric not null,
  target_price numeric not null,
  outcome text check (outcome in ('pending','win','loss','breakeven')) default 'pending',
  linked_trade_id uuid references public.trades(id) on delete set null,
  created_at timestamptz default now()
);

alter table public.crt_setups enable row level security;

drop policy if exists "select_own_crt_setups" on public.crt_setups;
create policy "select_own_crt_setups" on public.crt_setups
  for select using (auth.uid() = user_id);

drop policy if exists "insert_own_crt_setups" on public.crt_setups;
create policy "insert_own_crt_setups" on public.crt_setups
  for insert with check (auth.uid() = user_id);

drop policy if exists "update_own_crt_setups" on public.crt_setups;
create policy "update_own_crt_setups" on public.crt_setups
  for update using (auth.uid() = user_id);

drop policy if exists "delete_own_crt_setups" on public.crt_setups;
create policy "delete_own_crt_setups" on public.crt_setups
  for delete using (auth.uid() = user_id);
