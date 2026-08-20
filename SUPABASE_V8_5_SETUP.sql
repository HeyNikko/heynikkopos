-- HeyNikko POS V8.5 — Inventory Safety
-- Run ONCE in Supabase SQL Editor before closing another event.

create or replace function public.close_pos_event(
  p_event_id uuid,
  p_local_id text,
  p_closed_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event public.events%rowtype;
  v_row record;
  v_total_returned bigint := 0;
  v_products integer := 0;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;

  select * into v_event from public.events
  where id=p_event_id or local_id=p_local_id
  limit 1 for update;

  if v_event.id is null then raise exception 'Event not found'; end if;
  if v_event.status='closed' then
    return jsonb_build_object('event_id',v_event.id,'already_closed',true,'products_returned',0,'units_returned',0);
  end if;

  for v_row in
    select product_id,greatest(coalesce(current_qty,0),0)::integer as qty
    from public.event_inventory where event_id=v_event.id for update
  loop
    if v_row.qty>0 then
      update public.products
      set master_qty=greatest(coalesce(master_qty,0),0)+v_row.qty,updated_at=now()
      where id=v_row.product_id;

      update public.event_inventory
      set returned_qty=greatest(coalesce(returned_qty,0),0)+v_row.qty,current_qty=0,active=false,updated_at=now()
      where event_id=v_event.id and product_id=v_row.product_id;

      v_total_returned:=v_total_returned+v_row.qty;
      v_products:=v_products+1;
    else
      update public.event_inventory set current_qty=0,active=false,updated_at=now()
      where event_id=v_event.id and product_id=v_row.product_id;
    end if;
  end loop;

  update public.events set status='closed',closed_at=coalesce(p_closed_at,now()),updated_at=now()
  where id=v_event.id;

  return jsonb_build_object('event_id',v_event.id,'already_closed',false,'products_returned',v_products,'units_returned',v_total_returned);
end;
$$;

revoke all on function public.close_pos_event(uuid,text,timestamptz) from public;
grant execute on function public.close_pos_event(uuid,text,timestamptz) to authenticated;
notify pgrst, 'reload schema';
