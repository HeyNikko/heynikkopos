-- HeyNikko POS V8.4.2 — Live Master Stock + Product Catalogue Sync
-- Run ONCE in Supabase SQL Editor before using V8.4.2.
--
-- Adds public.products to the Supabase Realtime publication.
-- Existing V8.4 sales/event_inventory Realtime setup remains unchanged.

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname='supabase_realtime'
      and schemaname='public'
      and tablename='products'
  ) then
    alter publication supabase_realtime add table public.products;
  end if;
end $$;

alter table public.products replica identity full;

notify pgrst, 'reload schema';
