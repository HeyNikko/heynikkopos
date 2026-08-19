-- HeyNikko POS V8.1.1 — Event Sync Fix
-- Run ONCE in Supabase SQL Editor before testing V8.1.1.
--
-- V8.1 used a partial unique index on events.local_id.
-- PostgREST/Supabase upsert with onConflict=local_id may not resolve a partial index.
-- A normal UNIQUE index still permits multiple NULL values in PostgreSQL,
-- so it is the correct conflict target here.

alter table public.events
add column if not exists local_id text;

drop index if exists public.idx_events_local_id_unique;

create unique index if not exists idx_events_local_id_unique
on public.events(local_id);

-- Ensure event inventory has a valid upsert conflict target.
drop index if exists public.idx_event_inventory_event_product_unique;

create unique index if not exists idx_event_inventory_event_product_unique
on public.event_inventory(event_id, product_id);

-- Keep RLS enabled.
alter table public.events enable row level security;
alter table public.event_inventory enable row level security;

-- Recreate authenticated event policies safely.
drop policy if exists "Authenticated users can read events" on public.events;
drop policy if exists "Authenticated users can insert events" on public.events;
drop policy if exists "Authenticated users can update events" on public.events;
drop policy if exists "Authenticated users can delete events" on public.events;

create policy "Authenticated users can read events"
on public.events for select to authenticated using (true);
create policy "Authenticated users can insert events"
on public.events for insert to authenticated with check (true);
create policy "Authenticated users can update events"
on public.events for update to authenticated using (true) with check (true);
create policy "Authenticated users can delete events"
on public.events for delete to authenticated using (true);

drop policy if exists "Authenticated users can read event inventory" on public.event_inventory;
drop policy if exists "Authenticated users can insert event inventory" on public.event_inventory;
drop policy if exists "Authenticated users can update event inventory" on public.event_inventory;
drop policy if exists "Authenticated users can delete event inventory" on public.event_inventory;

create policy "Authenticated users can read event inventory"
on public.event_inventory for select to authenticated using (true);
create policy "Authenticated users can insert event inventory"
on public.event_inventory for insert to authenticated with check (true);
create policy "Authenticated users can update event inventory"
on public.event_inventory for update to authenticated using (true) with check (true);
create policy "Authenticated users can delete event inventory"
on public.event_inventory for delete to authenticated using (true);
