-- HeyNikko POS V8.5.1 — Cloud-safe closed Event deletion
-- Run ONCE in Supabase SQL Editor before using V8.5.1.
--
-- This is HISTORY deletion only.
-- It does NOT change Master Stock or Event Stock quantities.

create or replace function public.delete_pos_event(
  p_event_id uuid,
  p_local_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event public.events%rowtype;
  v_sales_deleted integer := 0;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select *
  into v_event
  from public.events
  where id=p_event_id or local_id=p_local_id
  limit 1
  for update;

  -- Safe retry: already deleted = success.
  if v_event.id is null then
    return jsonb_build_object(
      'deleted',false,
      'already_missing',true,
      'sales_deleted',0
    );
  end if;

  if v_event.status <> 'closed' then
    raise exception 'Only closed events can be permanently deleted';
  end if;

  -- Delete historical child rows first.
  -- NO INVENTORY ADJUSTMENT IS PERFORMED HERE.
  delete from public.sale_items
  where sale_id in (
    select id from public.sales where event_id=v_event.id
  );

  delete from public.sales
  where event_id=v_event.id;
  get diagnostics v_sales_deleted = row_count;

  delete from public.event_inventory
  where event_id=v_event.id;

  delete from public.events
  where id=v_event.id;

  return jsonb_build_object(
    'deleted',true,
    'already_missing',false,
    'event_id',v_event.id,
    'sales_deleted',v_sales_deleted
  );
end;
$$;

revoke all on function public.delete_pos_event(uuid,text) from public;
grant execute on function public.delete_pos_event(uuid,text) to authenticated;

notify pgrst, 'reload schema';
