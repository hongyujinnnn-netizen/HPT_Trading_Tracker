-- =====================================================================
-- Migration: Create public.profiles table (Strict 1 User = 1 Encrypted Profile)
-- Run this in the Supabase SQL Editor to add the profiles table without resetting existing data
-- =====================================================================

create table if not exists public.profiles (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null unique references auth.users(id) on delete cascade,
  name              text not null default 'Institutional Gold Trader',
  handle            text not null default '@xautrader',
  image_profile     text,
  tag               text not null default 'XAU/USD Specialist',
  tags              text[] not null default array['XAU/USD', 'London Session', 'ICT / SMC'],
  trading_style     text not null default 'ICT / Smart Money',
  risk_profile      text not null default 'Balanced Institutional (1%–2%)',
  preferred_session text not null default 'London & NY Overlap',
  location          text not null default 'Global Trading Desk',
  experience_level  text not null default 'Intermediate (1–3 yrs)',
  motto             text not null default 'Protect capital first. Execute A+ London & NY setups with strict stop-loss discipline.',
  bio               text not null default '',
  tradingview_url   text not null default '',
  telegram_handle   text not null default '',
  linked_account_id uuid references public.trading_accounts(id) on delete set null,
  is_active         boolean not null default true,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists idx_profiles_user_id on public.profiles(user_id);

alter table public.profiles enable row level security;

do $$ begin
  create policy "own profiles" on public.profiles
    for all using (auth.uid() = user_id)
    with check (auth.uid() = user_id);
exception when duplicate_object then null; end $$;
