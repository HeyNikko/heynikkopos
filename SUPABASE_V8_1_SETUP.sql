-- HeyNikko POS V8.1
-- Run ONCE in Supabase SQL Editor.
-- This preserves existing tables/data and adds the columns/constraints V8.1 needs.

alter table public.events add column if not exists local_id text;
alter table public.events add column if not exists name text;
alter table public.events add column if not exists start_date date;
alter table public.events add column if not exists end_date date;
alter table public.events add column if not exists status text default 'open';
alter table public.events add column if not exists created_at timestamptz default now();
alter table public.events add column if not exists closed_at timestamptz;
alter table public.events add column if not exists updated_at timestamptz default now();

create unique index if not exists idx_events_local_id_unique
on public.events(local_id) where local_id is not null;

alter table public.event_inventory add column if not exists event_id uuid references public.events(id) on delete cascade;
alter table public.event_inventory add column if not exists product_id uuid references public.products(id) on delete cascade;
alter table public.event_inventory add column if not exists opening_qty integer default 0;
alter table public.event_inventory add column if not exists added_qty integer default 0;
alter table public.event_inventory add column if not exists current_qty integer default 0;
alter table public.event_inventory add column if not exists returned_qty integer default 0;
alter table public.event_inventory add column if not exists active boolean default true;
alter table public.event_inventory add column if not exists updated_at timestamptz default now();

create unique index if not exists idx_event_inventory_event_product_unique
on public.event_inventory(event_id, product_id);

-- Product catalogue artwork is not private customer data.
-- V8.0.x generated public URLs, so the bucket itself must be public for iPad/browser images to render.
update storage.buckets
set public = true
where id = 'product-images';

-- Keep RLS enabled.
alter table public.events enable row level security;
alter table public.event_inventory enable row level security;

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
