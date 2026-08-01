-- =====================================================================
-- Live Gold Price (XAU/USD) — pg_cron, pg_net, Supabase Vault Setup
-- Run this script in your Supabase SQL Editor
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Schema Migration: Add 'source' column & check constraint to price_snapshots
-- ---------------------------------------------------------------------
alter table public.price_snapshots
  add column if not exists source text not null default 'unknown';

-- Backfill any pre-existing NULL or unspecified rows to 'unknown'
update public.price_snapshots
  set source = 'unknown'
  where source is null or source = '';

-- Add strict check constraint: enforces ('goldapi', 'simulated', 'unknown')
alter table public.price_snapshots
  drop constraint if exists chk_price_source;

alter table public.price_snapshots
  add constraint chk_price_source check (source in ('goldapi', 'simulated', 'unknown'));


-- ---------------------------------------------------------------------
-- 2. Enable Required Extensions
-- ---------------------------------------------------------------------
create extension if not exists pg_cron;
create extension if not exists pg_net;


-- ---------------------------------------------------------------------
-- 3. Store Edge Function URL & Service Role Key in Supabase Vault
-- Replace <project-ref> and <your-service-role-key> with your project details
-- ---------------------------------------------------------------------

-- Remove old secret entries if re-running
delete from vault.secrets where name in ('gold_price_function_url', 'gold_price_service_key');

-- Store Function URL
select vault.create_secret(
  'https://<project-ref>.functions.supabase.co/fetch-gold-price',
  'gold_price_function_url'
);

-- Store Service Role Key (encrypted at rest)
select vault.create_secret(
  '<your-service-role-key>',
  'gold_price_service_key'
);


-- ---------------------------------------------------------------------
-- 4. Schedule 5-Minute Cron Job (fetch-gold-price-5min)
-- ---------------------------------------------------------------------
-- Unschedule existing job if re-running
select cron.unschedule('fetch-gold-price-5min')
where exists (select 1 from cron.job where jobname = 'fetch-gold-price-5min');

select cron.schedule(
  'fetch-gold-price-5min',
  '*/5 * * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets
            where name = 'gold_price_function_url'),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (
        select decrypted_secret from vault.decrypted_secrets
        where name = 'gold_price_service_key'
      )
    )
  ) as request_id;
  $$
);


-- ---------------------------------------------------------------------
-- 5. Diagnostic Queries (Use these to verify setup)
-- ---------------------------------------------------------------------

-- A. Confirm Cron Job is scheduled
-- select * from cron.job where jobname = 'fetch-gold-price-5min';

-- B. Confirm Cron Job execution history & return status
-- select jobid, runid, job_pid, database, username, command, status, return_message, start_time, end_time
-- from cron.job_run_details
-- order by start_time desc
-- limit 10;

-- C. Inspect live price snapshots tagged by source
-- select id, symbol, price, spread, volatility_level, source, captured_at
-- from public.price_snapshots
-- order by captured_at desc
-- limit 15;

-- D. Test Check Constraint Enforcement (Should throw error chk_price_source)
-- insert into public.price_snapshots (symbol, price, source) values ('XAUUSD', 2400.0, 'invalid_source');
