-- HeyNikko POS V8.2 — Cloud Sales, Promotions & Atomic Event Stock
-- Run ONCE in Supabase SQL Editor before using V8.2.

-- SALES: preserve local browser IDs for idempotent offline retries.
alter table public.sales add column if not exists local_id text;
alter table public.sales add column if not exists receipt text;
alter table public.sales add column if not exists event_name text;
alter table public.sales add column if not exists updated_at timestamptz;

create unique index if not exists idx_sales_local_id_unique
on public.sales(local_id);

create unique index if not exists idx_sales_receipt_unique
on public.sales(receipt) where receipt is not null;

-- SALE ITEMS: preserve promo metadata used by the current POS.
alter table public.sale_items add column if not exists promo boolean not null default false;
alter table public.sale_items add column if not exists promo_id text;

-- PROMOTIONS: store current POS promotion objects losslessly.
alter table public.promotions add column if not exists local_id text;
alter table public.promotions add column if not exists promo_kind text;
alter table public.promotions add column if not exists payload jsonb;
alter table public.promotions add column if not exists updated_at timestamptz not null default now();

create unique index if not exists idx_promotions_local_id_unique
on public.promotions(local_id);

-- Ensure event stock upsert/locking columns exist.
alter table public.event_inventory add column if not exists current_qty integer not null default 0;
alter table public.event_inventory add column if not exists active boolean not null default true;
alter table public.event_inventory add column if not exists updated_at timestamptz not null default now();

-- RLS stays enabled.
alter table public.sales enable row level security;
alter table public.sale_items enable row level security;
alter table public.promotions enable row level security;

-- Authenticated read access for sales/items/promotions.
drop policy if exists "Authenticated users can read sales" on public.sales;
drop policy if exists "Authenticated users can insert sales" on public.sales;
drop policy if exists "Authenticated users can update sales" on public.sales;
drop policy if exists "Authenticated users can delete sales" on public.sales;
create policy "Authenticated users can read sales"
on public.sales for select to authenticated using (true);
create policy "Authenticated users can insert sales"
on public.sales for insert to authenticated with check (true);
create policy "Authenticated users can update sales"
on public.sales for update to authenticated using (true) with check (true);
create policy "Authenticated users can delete sales"
on public.sales for delete to authenticated using (true);

drop policy if exists "Authenticated users can read sale items" on public.sale_items;
drop policy if exists "Authenticated users can insert sale items" on public.sale_items;
drop policy if exists "Authenticated users can update sale items" on public.sale_items;
drop policy if exists "Authenticated users can delete sale items" on public.sale_items;
create policy "Authenticated users can read sale items"
on public.sale_items for select to authenticated using (true);
create policy "Authenticated users can insert sale items"
on public.sale_items for insert to authenticated with check (true);
create policy "Authenticated users can update sale items"
on public.sale_items for update to authenticated using (true) with check (true);
create policy "Authenticated users can delete sale items"
on public.sale_items for delete to authenticated using (true);

drop policy if exists "Authenticated users can read promotions" on public.promotions;
drop policy if exists "Authenticated users can insert promotions" on public.promotions;
drop policy if exists "Authenticated users can update promotions" on public.promotions;
drop policy if exists "Authenticated users can delete promotions" on public.promotions;
create policy "Authenticated users can read promotions"
on public.promotions for select to authenticated using (true);
create policy "Authenticated users can insert promotions"
on public.promotions for insert to authenticated with check (true);
create policy "Authenticated users can update promotions"
on public.promotions for update to authenticated using (true) with check (true);
create policy "Authenticated users can delete promotions"
on public.promotions for delete to authenticated using (true);

-- Atomic, idempotent sale recorder.
-- It locks each event_inventory row, verifies stock, decrements stock,
-- creates the sale, then creates its items in one database transaction.
create or replace function public.record_pos_sale(
  p_local_id text,
  p_receipt text,
  p_event_id uuid,
  p_event_name text,
  p_payment_method text,
  p_subtotal numeric,
  p_discount numeric,
  p_total numeric,
  p_created_at timestamptz,
  p_items jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sale_id uuid;
  v_item jsonb;
  v_product_id uuid;
  v_qty integer;
  v_available integer;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select id into v_sale_id
  from public.sales
  where local_id = p_local_id
  limit 1;

  if v_sale_id is not null then
    return jsonb_build_object('sale_id',v_sale_id,'duplicate',true);
  end if;

  -- Validate and lock stock first.
  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_product_id := (v_item->>'product_id')::uuid;
    v_qty := greatest(0,(v_item->>'quantity')::integer);

    select current_qty into v_available
    from public.event_inventory
    where event_id=p_event_id and product_id=v_product_id
    for update;

    if v_available is null then
      raise exception 'Product % is not allocated to this event', coalesce(v_item->>'sku',v_product_id::text);
    end if;

    if v_available < v_qty then
      raise exception 'Insufficient event stock for %: cloud has %, sale needs %',
        coalesce(v_item->>'sku',v_product_id::text),v_available,v_qty;
    end if;
  end loop;

  insert into public.sales(
    local_id,receipt,event_id,event_name,payment_method,
    subtotal,discount,total,status,created_at,updated_at
  )
  values(
    p_local_id,p_receipt,p_event_id,p_event_name,p_payment_method,
    p_subtotal,p_discount,p_total,'completed',p_created_at,now()
  )
  returning id into v_sale_id;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_product_id := (v_item->>'product_id')::uuid;
    v_qty := greatest(0,(v_item->>'quantity')::integer);

    update public.event_inventory
    set current_qty=current_qty-v_qty,
        updated_at=now()
    where event_id=p_event_id and product_id=v_product_id;

    insert into public.sale_items(
      sale_id,product_id,sku,product_name,quantity,
      unit_price,line_total,promo,promo_id
    )
    values(
      v_sale_id,
      v_product_id,
      v_item->>'sku',
      v_item->>'product_name',
      v_qty,
      coalesce((v_item->>'unit_price')::numeric,0),
      coalesce((v_item->>'line_total')::numeric,0),
      coalesce((v_item->>'promo')::boolean,false),
      nullif(v_item->>'promo_id','')
    );
  end loop;

  return jsonb_build_object('sale_id',v_sale_id,'duplicate',false);
end;
$$;

revoke all on function public.record_pos_sale(text,text,uuid,text,text,numeric,numeric,numeric,timestamptz,jsonb) from public;
grant execute on function public.record_pos_sale(text,text,uuid,text,text,numeric,numeric,numeric,timestamptz,jsonb) to authenticated;

notify pgrst, 'reload schema';
