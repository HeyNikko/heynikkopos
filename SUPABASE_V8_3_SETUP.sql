-- HeyNikko POS V8.3 — Cloud-safe voiding
-- Run ONCE in Supabase SQL Editor before using V8.3.

alter table public.sales add column if not exists voided_at timestamptz;

create or replace function public.void_pos_sale(
  p_sale_id uuid,
  p_local_id text,
  p_voided_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sale public.sales%rowtype;
  v_item record;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select * into v_sale
  from public.sales
  where id=p_sale_id or local_id=p_local_id
  limit 1
  for update;

  if v_sale.id is null then
    raise exception 'Sale not found';
  end if;

  if v_sale.status='voided' then
    return jsonb_build_object('sale_id',v_sale.id,'already_voided',true);
  end if;

  for v_item in
    select product_id, quantity
    from public.sale_items
    where sale_id=v_sale.id
  loop
    update public.event_inventory
    set current_qty=current_qty+coalesce(v_item.quantity,0),
        updated_at=now()
    where event_id=v_sale.event_id
      and product_id=v_item.product_id;
  end loop;

  update public.sales
  set status='voided',
      voided_at=coalesce(p_voided_at,now()),
      updated_at=now()
  where id=v_sale.id;

  return jsonb_build_object('sale_id',v_sale.id,'already_voided',false);
end;
$$;

revoke all on function public.void_pos_sale(uuid,text,timestamptz) from public;
grant execute on function public.void_pos_sale(uuid,text,timestamptz) to authenticated;

notify pgrst, 'reload schema';
