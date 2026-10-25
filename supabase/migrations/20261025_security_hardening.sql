-- =====================================================================
-- Security hardening (2026-10-25)
-- Safe to re-run. Apply in the Supabase SQL Editor or via `supabase db push`.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. UPDATE policies must also have WITH CHECK.
--    Without it, a user can UPDATE their own row and set user_id to another
--    user's id, pushing data into someone else's account.
-- ---------------------------------------------------------------------
drop policy if exists "update_own_crt_setups" on public.crt_setups;
create policy "update_own_crt_setups" on public.crt_setups
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "update_own_target_plans" on public.target_plans;
create policy "update_own_target_plans" on public.target_plans
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);


-- ---------------------------------------------------------------------
-- 2. Private storage bucket for trade screenshots.
--    Objects are stored as `<user_id>/<trade_id>/entry.png`; each user may only
--    touch objects inside their own top-level folder.
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'trade-screenshots',
  'trade-screenshots',
  false,
  5242880, -- 5 MB, mirrors client-side limit
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do update
  set public             = false,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "screenshots_select_own" on storage.objects;
create policy "screenshots_select_own" on storage.objects
  for select to authenticated
  using (bucket_id = 'trade-screenshots' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "screenshots_insert_own" on storage.objects;
create policy "screenshots_insert_own" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'trade-screenshots' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "screenshots_update_own" on storage.objects;
create policy "screenshots_update_own" on storage.objects
  for update to authenticated
  using (bucket_id = 'trade-screenshots' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'trade-screenshots' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "screenshots_delete_own" on storage.objects;
create policy "screenshots_delete_own" on storage.objects
  for delete to authenticated
  using (bucket_id = 'trade-screenshots' and (storage.foldername(name))[1] = auth.uid()::text);


-- ---------------------------------------------------------------------
-- 3. Expand price_snapshots source check constraint to distinguish
--    GoldAPI.io ('goldapi') from open fallbacks ('gold-api', 'coingecko').
-- ---------------------------------------------------------------------
alter table public.price_snapshots
  drop constraint if exists chk_price_source;

alter table public.price_snapshots
  add constraint chk_price_source
  check (source in ('goldapi', 'gold-api', 'coingecko', 'simulated', 'unknown'));

