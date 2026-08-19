-- HeyNikko POS V8.4 — Realtime multi-device sync
-- Run ONCE in Supabase SQL Editor before using V8.4.
--
-- Enables Supabase Realtime publication for:
--   sales          -> new sale / void / permanent delete
--   sale_items     -> item rows for new sales
--   event_inventory -> live booth stock updates
--
-- Safe to run again: tables already in the realtime publication are skipped.

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname='supabase_realtime' and schemaname='public' and tablename='sales'
  ) then
    alter publication supabase_realtime add table public.sales;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname='supabase_realtime' and schemaname='public' and tablename='sale_items'
  ) then
    alter publication supabase_realtime add table public.sale_items;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname='supabase_realtime' and schemaname='public' and tablename='event_inventory'
  ) then
    alter publication supabase_realtime add table public.event_inventory;
  end if;
end $$;

-- Give UPDATE/DELETE events stable row identity for realtime payloads.
alter table public.sales replica identity full;
alter table public.sale_items replica identity full;
alter table public.event_inventory replica identity full;

notify pgrst, 'reload schema';
