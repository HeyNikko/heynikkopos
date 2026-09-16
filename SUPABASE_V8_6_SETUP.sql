-- HeyNikko POS V8.6 — Event-based Multi-Currency
-- Run ONCE in Supabase SQL Editor before using V8.6.
-- Additive migration: existing records remain SGD at exchange rate 1.

alter table public.events
  add column if not exists currency_code text not null default 'SGD',
  add column if not exists exchange_rate numeric not null default 1,
  add column if not exists price_rounding numeric not null default 0;

alter table public.sales
  add column if not exists currency_code text not null default 'SGD',
  add column if not exists exchange_rate numeric not null default 1;

create or replace function public.record_pos_sale(
  p_local_id text,p_receipt text,p_event_id uuid,p_event_name text,p_payment_method text,
  p_subtotal numeric,p_discount numeric,p_total numeric,p_created_at timestamptz,
  p_currency_code text,p_exchange_rate numeric,p_items jsonb
)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_sale_id uuid;v_item jsonb;v_product_id uuid;v_qty integer;v_available integer;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select id into v_sale_id from public.sales where local_id=p_local_id limit 1;
  if v_sale_id is not null then return jsonb_build_object('sale_id',v_sale_id,'duplicate',true); end if;
  for v_item in select * from jsonb_array_elements(p_items) loop
    v_product_id:=(v_item->>'product_id')::uuid;v_qty:=greatest(0,(v_item->>'quantity')::integer);
    select current_qty into v_available from public.event_inventory where event_id=p_event_id and product_id=v_product_id for update;
    if v_available is null then raise exception 'Product % is not allocated to this event',coalesce(v_item->>'sku',v_product_id::text); end if;
    if v_available<v_qty then raise exception 'Insufficient event stock for %: cloud has %, sale needs %',coalesce(v_item->>'sku',v_product_id::text),v_available,v_qty; end if;
  end loop;
  insert into public.sales(local_id,receipt,event_id,event_name,payment_method,subtotal,discount,total,status,created_at,updated_at,currency_code,exchange_rate)
  values(p_local_id,p_receipt,p_event_id,p_event_name,p_payment_method,p_subtotal,p_discount,p_total,'completed',p_created_at,now(),coalesce(nullif(p_currency_code,''),'SGD'),coalesce(p_exchange_rate,1)) returning id into v_sale_id;
  for v_item in select * from jsonb_array_elements(p_items) loop
    v_product_id:=(v_item->>'product_id')::uuid;v_qty:=greatest(0,(v_item->>'quantity')::integer);
    update public.event_inventory set current_qty=current_qty-v_qty,updated_at=now() where event_id=p_event_id and product_id=v_product_id;
    insert into public.sale_items(sale_id,product_id,sku,product_name,quantity,unit_price,line_total,promo,promo_id)
    values(v_sale_id,v_product_id,v_item->>'sku',v_item->>'product_name',v_qty,coalesce((v_item->>'unit_price')::numeric,0),coalesce((v_item->>'line_total')::numeric,0),coalesce((v_item->>'promo')::boolean,false),nullif(v_item->>'promo_id',''));
  end loop;
  return jsonb_build_object('sale_id',v_sale_id,'duplicate',false);
end;$$;
revoke all on function public.record_pos_sale(text,text,uuid,text,text,numeric,numeric,numeric,timestamptz,text,numeric,jsonb) from public;
grant execute on function public.record_pos_sale(text,text,uuid,text,text,numeric,numeric,numeric,timestamptz,text,numeric,jsonb) to authenticated;

create or replace function public.update_pos_sale_details(
  p_sale_id uuid,p_local_id text,p_payment_method text,p_subtotal numeric,p_discount numeric,p_total numeric,
  p_edited_at timestamptz,p_currency_code text,p_exchange_rate numeric,p_items jsonb
)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_sale_id uuid;v_item jsonb;v_product_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select id into v_sale_id from public.sales where id=p_sale_id or local_id=p_local_id limit 1 for update;
  if v_sale_id is null then raise exception 'Sale not found'; end if;
  update public.sales set payment_method=p_payment_method,subtotal=p_subtotal,discount=p_discount,total=p_total,edited_at=coalesce(p_edited_at,now()),currency_code=coalesce(nullif(p_currency_code,''),'SGD'),exchange_rate=coalesce(p_exchange_rate,1),updated_at=now() where id=v_sale_id;
  delete from public.sale_items where sale_id=v_sale_id;
  for v_item in select * from jsonb_array_elements(p_items) loop
    v_product_id:=(v_item->>'product_id')::uuid;
    insert into public.sale_items(sale_id,product_id,sku,product_name,quantity,unit_price,line_total,promo,promo_id)
    values(v_sale_id,v_product_id,v_item->>'sku',v_item->>'product_name',greatest(0,(v_item->>'quantity')::integer),coalesce((v_item->>'unit_price')::numeric,0),coalesce((v_item->>'line_total')::numeric,0),coalesce((v_item->>'promo')::boolean,false),nullif(v_item->>'promo_id',''));
  end loop;
  return jsonb_build_object('sale_id',v_sale_id,'edited',true);
end;$$;
revoke all on function public.update_pos_sale_details(uuid,text,text,numeric,numeric,numeric,timestamptz,text,numeric,jsonb) from public;
grant execute on function public.update_pos_sale_details(uuid,text,text,numeric,numeric,numeric,timestamptz,text,numeric,jsonb) to authenticated;
notify pgrst,'reload schema';
