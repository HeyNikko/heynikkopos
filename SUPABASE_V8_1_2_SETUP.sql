-- HeyNikko POS V8.1.2 — Unified Sync Setup
-- Run once in Supabase SQL Editor.

-- EVENTS
alter table public.events add column if not exists local_id text;
alter table public.events add column if not exists updated_at timestamptz not null default now();

drop index if exists public.idx_events_local_id_unique;
create unique index if not exists idx_events_local_id_unique
on public.events(local_id);

-- EVENT INVENTORY
alter table public.event_inventory add column if not exists opening_qty integer not null default 0;
alter table public.event_inventory add column if not exists added_qty integer not null default 0;
alter table public.event_inventory add column if not exists current_qty integer not null default 0;
alter table public.event_inventory add column if not exists returned_qty integer not null default 0;
alter table public.event_inventory add column if not exists active boolean not null default true;
alter table public.event_inventory add column if not exists updated_at timestamptz not null default now();

drop index if exists public.idx_event_inventory_event_product_unique;
create unique index if not exists idx_event_inventory_event_product_unique
on public.event_inventory(event_id,product_id);

-- PRODUCTS
alter table public.products add column if not exists updated_at timestamptz not null default now();

-- Product catalogue artwork must be readable by the browser/iPad.
update storage.buckets set public=true where id='product-images';

-- RLS remains enabled.
alter table public.products enable row level security;
alter table public.events enable row level security;
alter table public.event_inventory enable row level security;

-- Reload PostgREST schema cache so newly-added columns are immediately visible.
notify pgrst, 'reload schema';
