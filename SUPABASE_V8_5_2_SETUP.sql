-- HeyNikko POS V8.5.2 — Live Event Lifecycle Sync
-- Run ONCE in Supabase SQL Editor before using V8.5.2.
--
-- Adds events table to Supabase Realtime.
-- V8.5.2 app code also changes event sync from "upload every local event"
-- to a pending/dirty-event queue, preventing stale devices from reopening closed events.

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname='supabase_realtime'
      and schemaname='public'
      and tablename='events'
  ) then
    alter publication supabase_realtime add table public.events;
  end if;
end $$;

alter table public.events replica identity full;

notify pgrst, 'reload schema';
