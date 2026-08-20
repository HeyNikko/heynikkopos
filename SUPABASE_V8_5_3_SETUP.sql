-- HeyNikko POS V8.5.3 — Cart preservation + true Sale Edit status
-- Run ONCE in Supabase SQL Editor before using V8.5.3.
--
-- Adds a dedicated edited_at field.
-- updated_at remains a technical database/sync timestamp and is NOT used
-- to decide whether a sale should display EDITED.

alter table public.sales
add column if not exists edited_at timestamptz;

-- Updates an already-recorded sale's commercial details and line items.
-- Inventory is NOT adjusted here.
-- The POS event-inventory sync already carries the local stock result of the edit,
-- preventing stock from being adjusted twice.
create or replace function public.update_pos_sale_details(
  p_sale_id uuid,
  p_local_id text,
  p_payment_method text,
  p_subtotal numeric,
  p_discount numeric,
  p_total numeric,
  p_edited_at timestamptz,
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
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select id
  into v_sale_id
  from public.sales
  where id=p_sale_id or local_id=p_local_id
  limit 1
  for update;

  if v_sale_id is null then
    raise exception 'Sale not found';
  end if;

  update public.sales
  set payment_method=p_payment_method,
      subtotal=p_subtotal,
      discount=p_discount,
      total=p_total,
      edited_at=coalesce(p_edited_at,now()),
      updated_at=now()
  where id=v_sale_id;

  delete from public.sale_items
  where sale_id=v_sale_id;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_product_id := (v_item->>'product_id')::uuid;

    insert into public.sale_items(
      sale_id,product_id,sku,product_name,quantity,
      unit_price,line_total,promo,promo_id
    )
    values(
      v_sale_id,
      v_product_id,
      v_item->>'sku',
      v_item->>'product_name',
      greatest(0,(v_item->>'quantity')::integer),
      coalesce((v_item->>'unit_price')::numeric,0),
      coalesce((v_item->>'line_total')::numeric,0),
      coalesce((v_item->>'promo')::boolean,false),
      nullif(v_item->>'promo_id','')
    );
  end loop;

  return jsonb_build_object(
    'sale_id',v_sale_id,
    'edited',true
  );
end;
$$;

revoke all on function public.update_pos_sale_details(uuid,text,text,numeric,numeric,numeric,timestamptz,jsonb) from public;
grant execute on function public.update_pos_sale_details(uuid,text,text,numeric,numeric,numeric,timestamptz,jsonb) to authenticated;

notify pgrst, 'reload schema';
