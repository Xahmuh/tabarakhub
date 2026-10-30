-- Allow the trusted WordPress Seller bridge to sync updated order totals,
-- payment collection amounts, and pharmacist name when a branch edits a
-- WooCommerce order while it is still in 'assigned' status (before pickup).
do $$
declare
  definition text;
  old_fields text := 'array[''driver_id'', ''assigned_at'', ''lifecycle_updated_at'', ''delivery_status'', ''cancelled_at'', ''cancelled_reason'', ''updated_at'', ''updated_by'']::text[]';
  new_fields text := 'array[''driver_id'', ''assigned_at'', ''lifecycle_updated_at'', ''delivery_status'', ''cancelled_at'', ''cancelled_reason'', ''value_bhd'', ''payment_type'', ''payment_collection_status'', ''amount_received_bhd'', ''amount_to_collect_bhd'', ''pharmacist_name'', ''notes'', ''updated_at'', ''updated_by'']::text[]';
begin
  select pg_get_functiondef('public.delivery_orders_guard_branch_update()'::regprocedure) into definition;
  if position(old_fields in definition) = 0 then
    raise exception 'Seller assignment guard differs from the expected version';
  end if;
  execute replace(definition, old_fields, new_fields);
end;
$$;

do $$
declare
  definition text;
  old_update text := E'set driver_id = p_driver_id, assigned_at = now(), lifecycle_updated_at = now(),\n    delivery_status = ''assigned'', cancelled_at = null, cancelled_reason = null';
  new_update text := E'set driver_id = p_driver_id, assigned_at = now(), lifecycle_updated_at = now(),\n    delivery_status = ''assigned'', cancelled_at = null, cancelled_reason = null,\n    value_bhd = round(p_value_bhd, 3), payment_type = v_payment,\n    payment_collection_status = v_collection_status, amount_received_bhd = v_received,\n    pharmacist_name = coalesce(nullif(btrim(p_pharmacist_name), ''''), pharmacist_name),\n    notes = coalesce(nullif(btrim(p_notes), ''''), notes)';
  old_tail text := E'    return v_existing.id;\n  end if;';
  new_tail text := E'    if v_existing.delivery_status = ''assigned'' and (\n'
    || E'      v_existing.value_bhd is distinct from round(p_value_bhd, 3)\n'
    || E'      or v_existing.amount_received_bhd is distinct from v_received\n'
    || E'      or v_existing.payment_type is distinct from v_payment\n'
    || E'      or v_existing.pharmacist_name is distinct from coalesce(nullif(btrim(p_pharmacist_name), ''''), v_existing.pharmacist_name)\n'
    || E'    ) then\n'
    || E'      perform set_config(''app.seller_assignment_rpc'', ''true'', true);\n'
    || E'      update public.delivery_orders\n'
    || E'      set value_bhd = round(p_value_bhd, 3), payment_type = v_payment,\n'
    || E'          payment_collection_status = v_collection_status, amount_received_bhd = v_received,\n'
    || E'          pharmacist_name = coalesce(nullif(btrim(p_pharmacist_name), ''''), pharmacist_name),\n'
    || E'          notes = coalesce(nullif(btrim(p_notes), ''''), notes),\n'
    || E'          lifecycle_updated_at = now()\n'
    || E'      where id = v_existing.id\n'
    || E'      returning * into v_order;\n'
    || E'      perform public.delivery_driver_recompute_daily_stats(p_driver_id, v_order.order_date);\n'
    || E'    end if;\n'
    || E'    return v_existing.id;\n  end if;';
begin
  select pg_get_functiondef('public.app_seller_import_assigned_order(text,text,text,uuid,date,numeric,text,numeric,text,text,text,text,text,numeric,numeric,text)'::regprocedure)
    into definition;
  if position(old_update in definition) = 0 or position(old_tail in definition) = 0 then
    raise exception 'Seller assignment RPC differs from the expected version';
  end if;
  definition := replace(definition, old_update, new_update);
  execute replace(definition, old_tail, new_tail);
end;
$$;

notify pgrst, 'reload schema';
