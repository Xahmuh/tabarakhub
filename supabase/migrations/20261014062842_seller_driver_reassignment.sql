-- Allow the trusted WordPress bridge to reassign a WooCommerce delivery while
-- it is still assigned and has not been picked up. Keep the existing order row
-- and append a lifecycle event so driver history remains auditable.
do $$
declare
  definition text;
  marker text := 'if public.current_app_can_manage() then';
  replacement text := E'  if auth.role() = ''service_role''\n    and coalesce(current_setting(''app.seller_assignment_rpc'', true), '''') = ''true'' then\n'
    || E'    if old.external_source is distinct from ''woocommerce''\n'
    || E'      or new.external_source is distinct from old.external_source\n'
    || E'      or new.external_order_id is distinct from old.external_order_id\n'
    || E'      or new.branch_id is distinct from old.branch_id\n'
    || E'      or new.delivery_status is distinct from old.delivery_status\n'
    || E'      or old.delivery_status is distinct from ''assigned'' then\n'
    || E'      raise exception ''Only unpicked WooCommerce orders can be reassigned'' using errcode = ''42501'';\n'
    || E'    end if;\n'
    || E'    if (to_jsonb(new) - array[''driver_id'', ''assigned_at'', ''lifecycle_updated_at'', ''updated_at'', ''updated_by'']::text[])\n'
    || E'      <> (to_jsonb(old) - array[''driver_id'', ''assigned_at'', ''lifecycle_updated_at'', ''updated_at'', ''updated_by'']::text[]) then\n'
    || E'      raise exception ''Seller reassignment can change only the assigned driver'' using errcode = ''42501'';\n'
    || E'    end if;\n'
    || E'    new.updated_at := now();\n'
    || E'    new.updated_by := null;\n'
    || E'    return new;\n'
    || E'  end if;\n\n  '
    || marker;
begin
  select pg_get_functiondef('public.delivery_orders_guard_branch_update()'::regprocedure) into definition;
  if position(marker in definition) = 0 then
    raise exception 'Could not safely extend the delivery order update guard';
  end if;
  execute replace(definition, marker, replacement);
end;
$$;

do $$
declare
  definition text;
  marker text := 'if v_existing.driver_id is distinct from p_driver_id then';
  replacement text := E'if v_existing.driver_id is distinct from p_driver_id then\n'
    || E'  if v_existing.branch_id is distinct from v_branch_id then\n'
    || E'    raise exception ''WooCommerce order is already linked to another branch'' using errcode = ''23505'';\n'
    || E'  end if;\n'
    || E'  if v_existing.delivery_status is distinct from ''assigned'' then\n'
    || E'      raise exception ''Only unpicked orders can be reassigned'' using errcode = ''23505'';\n'
    || E'  end if;\n'
    || E'  perform set_config(''app.seller_assignment_rpc'', ''true'', true);\n'
    || E'  update public.delivery_orders\n'
    || E'  set driver_id = p_driver_id, assigned_at = now(), lifecycle_updated_at = now()\n'
    || E'  where id = v_existing.id\n'
    || E'  returning * into v_order;\n'
    || E'  insert into public.delivery_order_events (\n'
    || E'    order_id, branch_id, event_type, previous_status, new_status, driver_id, actor_role, notes, order_snapshot, metadata\n'
    || E'  ) values (\n'
    || E'    v_order.id, v_branch_id, ''assigned'', ''assigned'', ''assigned'', p_driver_id, ''seller_wordpress'',\n'
    || E'    ''Reassigned from driver '' || coalesce(v_existing.driver_id::text, ''unknown''), to_jsonb(v_order),\n'
    || E'    jsonb_build_object(''source'', ''woocommerce'', ''external_order_id'', p_external_order_id,\n'
    || E'      ''previous_driver_id'', v_existing.driver_id, ''new_driver_id'', p_driver_id)\n'
    || E'  );\n'
    || E'  if v_existing.driver_id is not null then\n'
    || E'    perform public.delivery_driver_recompute_daily_stats(v_existing.driver_id, v_existing.order_date);\n'
    || E'  end if;\n'
    || E'  perform public.delivery_driver_recompute_daily_stats(p_driver_id, v_order.order_date);\n'
    || E'  return v_order.id;\n'
    || E'end if;\n  if v_existing.driver_id is distinct from p_driver_id then';
begin
  select pg_get_functiondef('public.app_seller_import_assigned_order(text,text,text,uuid,date,numeric,text,numeric,text,text,text,text,text,numeric,numeric,text)'::regprocedure)
  into definition;
  if position(marker in definition) = 0 then
    raise exception 'Could not safely extend the seller order import function';
  end if;
  execute replace(definition, marker, replacement);
end;
$$;

notify pgrst, 'reload schema';
