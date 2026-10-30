-- A driver may decline an assigned WooCommerce pickup. Keep the delivery row
-- and audit trail, then allow the trusted Seller bridge to assign it again.
do $$
declare
  definition text;
  old_guard text := E'      or new.delivery_status is distinct from old.delivery_status\n      or old.delivery_status is distinct from ''assigned'' then';
  new_guard text := E'      or not (\n        (old.delivery_status = ''assigned'' and new.delivery_status = ''assigned'')\n        or (old.delivery_status = ''cancelled'' and old.picked_up_at is null\n          and new.delivery_status = ''assigned'' and new.cancelled_at is null\n          and new.cancelled_reason is null)\n      ) then';
  old_fields text := 'array[''driver_id'', ''assigned_at'', ''lifecycle_updated_at'', ''updated_at'', ''updated_by'']::text[]';
  new_fields text := 'array[''driver_id'', ''assigned_at'', ''lifecycle_updated_at'', ''delivery_status'', ''cancelled_at'', ''cancelled_reason'', ''updated_at'', ''updated_by'']::text[]';
begin
  select pg_get_functiondef('public.delivery_orders_guard_branch_update()'::regprocedure) into definition;
  if position(old_guard in definition) = 0 or position(old_fields in definition) = 0 then
    raise exception 'Seller assignment guard differs from the expected version';
  end if;
  definition := replace(definition, old_guard, new_guard);
  execute replace(definition, old_fields, new_fields);
end;
$$;

do $$
declare
  definition text;
  old_status text := E'if v_existing.delivery_status is distinct from ''assigned'' then\n      raise exception ''Only unpicked orders can be reassigned'' using errcode = ''23505'';\n  end if;';
  new_status text := E'if not (v_existing.delivery_status = ''assigned''\n    or (v_existing.delivery_status = ''cancelled'' and v_existing.picked_up_at is null)) then\n    raise exception ''Only unpicked orders can be reassigned'' using errcode = ''23505'';\n  end if;';
  old_update text := E'set driver_id = p_driver_id, assigned_at = now(), lifecycle_updated_at = now()';
  new_update text := E'set driver_id = p_driver_id, assigned_at = now(), lifecycle_updated_at = now(),\n    delivery_status = ''assigned'', cancelled_at = null, cancelled_reason = null';
  old_event text := E'v_order.id, v_branch_id, ''assigned'', ''assigned'', ''assigned'', p_driver_id, ''seller_wordpress'',';
  new_event text := E'v_order.id, v_branch_id, ''assigned'', v_existing.delivery_status, ''assigned'', p_driver_id, ''seller_wordpress'',';
begin
  select pg_get_functiondef('public.app_seller_import_assigned_order(text,text,text,uuid,date,numeric,text,numeric,text,text,text,text,text,numeric,numeric,text)'::regprocedure)
    into definition;
  if position(old_status in definition) = 0 or position(old_update in definition) = 0
    or position(old_event in definition) = 0 then
    raise exception 'Seller assignment RPC differs from the expected version';
  end if;
  definition := regexp_replace(definition,
    'if v_existing\.driver_id is distinct from p_driver_id then',
    'if v_existing.driver_id is distinct from p_driver_id or v_existing.delivery_status = ''cancelled'' then');
  definition := replace(definition, old_status, new_status);
  definition := replace(definition, old_update, new_update);
  execute replace(definition, old_event, new_event);
end;
$$;

notify pgrst, 'reload schema';
