-- HeyNikko POS V8.3.1 — Cloud-safe permanent deletion
-- Run ONCE in Supabase SQL Editor.

create or replace function public.delete_pos_sale(
  p_sale_id uuid,
  p_local_id text
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
  if auth.uid() is null then raise exception 'Authentication required'; end if;

  select * into v_sale
  from public.sales
  where id=p_sale_id or local_id=p_local_id
  limit 1
  for update;

  if v_sale.id is null then
    return jsonb_build_object('deleted',false,'already_missing',true);
  end if;

  if coalesce(v_sale.status,'completed') <> 'voided' then
    for v_item in select product_id,quantity from public.sale_items where sale_id=v_sale.id loop
      update public.event_inventory
      set current_qty=current_qty+coalesce(v_item.quantity,0),updated_at=now()
      where event_id=v_sale.event_id and product_id=v_item.product_id;
    end loop;
  end if;

  delete from public.sale_items where sale_id=v_sale.id;
  delete from public.sales where id=v_sale.id;

  return jsonb_build_object('deleted',true,'already_missing',false);
end;
$$;

revoke all on function public.delete_pos_sale(uuid,text) from public;
grant execute on function public.delete_pos_sale(uuid,text) to authenticated;
notify pgrst, 'reload schema';
