-- Admin-only corrections. Every change is checked and logged in one DB transaction.
begin;
create table if not exists public.admin_record_corrections (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null,
  action text not null,
  target_id uuid not null,
  reason text not null,
  before_row jsonb not null,
  after_row jsonb not null,
  created_at timestamptz not null default now()
);
alter table public.admin_record_corrections enable row level security;
revoke all on public.admin_record_corrections from public, anon, authenticated;
grant select on public.admin_record_corrections to authenticated;
create policy admin_record_corrections_read on public.admin_record_corrections
  for select to authenticated using (public.current_app_role() = 'admin');

create table if not exists public.benefit_pay_deleted_transfers (
  transfer_id uuid primary key,
  snapshot jsonb not null,
  deleted_by uuid,
  deleted_at timestamptz not null default now(),
  restored_by uuid,
  restored_at timestamptz
);
alter table public.benefit_pay_deleted_transfers enable row level security;
revoke all on public.benefit_pay_deleted_transfers from public, anon, authenticated;
grant select on public.benefit_pay_deleted_transfers to authenticated;
create policy benefit_pay_deleted_admin_read on public.benefit_pay_deleted_transfers
  for select to authenticated using (public.current_app_role() = 'admin');

create or replace function public.archive_deleted_manual_benefit_pay()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if old.source = 'manual' then
    insert into public.benefit_pay_deleted_transfers
      (transfer_id, snapshot, deleted_by, deleted_at, restored_by, restored_at)
    values (old.id, to_jsonb(old), auth.uid(), now(), null, null)
    on conflict (transfer_id) do update
      set snapshot = excluded.snapshot, deleted_by = excluded.deleted_by,
          deleted_at = excluded.deleted_at, restored_by = null, restored_at = null;
  end if;
  return old;
end $$;
drop trigger if exists archive_deleted_manual_benefit_pay_trigger on public.benefit_pay_transfers;
create trigger archive_deleted_manual_benefit_pay_trigger
  before delete on public.benefit_pay_transfers for each row
  execute function public.archive_deleted_manual_benefit_pay();
revoke all on function public.archive_deleted_manual_benefit_pay() from public, anon, authenticated;

create or replace function public.app_admin_move_delivery_order(
  p_order_id uuid, p_target_branch_id uuid, p_reason text
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_order public.delivery_orders%rowtype;
  v_before jsonb;
  v_after jsonb;
  v_bp public.benefit_pay_transfers%rowtype;
  v_number text;
begin
  if public.current_app_role() <> 'admin' or auth.uid() is null then
    raise exception 'Admin account required' using errcode = '42501';
  end if;
  if length(btrim(coalesce(p_reason, ''))) < 5 then
    raise exception 'A correction reason of at least 5 characters is required';
  end if;
  select * into v_order from public.delivery_orders where id = p_order_id for update;
  if not found then raise exception 'Order not found'; end if;
  if v_order.branch_id = p_target_branch_id then raise exception 'Order is already in this branch'; end if;
  if not exists (select 1 from public.branches where id = p_target_branch_id and role = 'branch') then
    raise exception 'Target branch not found';
  end if;
  if v_order.order_kind = 'internal_transfer'
    or v_order.delivery_status not in ('recorded', 'cancelled')
    or v_order.driver_id is not null or v_order.pickup_batch_id is not null
    or v_order.deleted_at is not null then
    raise exception 'Only unassigned recorded or cancelled delivery orders can be moved';
  end if;
  if v_order.pharmacist_id is not null and not exists (
    select 1 from public.pharmacist_branches
    where pharmacist_id = v_order.pharmacist_id and branch_id = p_target_branch_id
  ) then
    raise exception 'Pharmacist is not assigned to the target branch';
  end if;
  v_before := to_jsonb(v_order);
  select * into v_bp from public.benefit_pay_transfers
    where delivery_order_id = v_order.id for update;
  if found then
    update public.benefit_pay_transfers b
      set branch_id = p_target_branch_id,
          sequence_no = public.benefit_pay_next_sequence(p_target_branch_id, b.transfer_date)
      where id = v_bp.id;
  end if;
  if upper(v_order.payment_type) = 'TALABAT' then
    v_number := public.delivery_next_talabat_order_number(p_target_branch_id, v_order.order_date);
  else
    v_number := public.delivery_next_order_number(p_target_branch_id, v_order.order_date);
  end if;
  update public.delivery_orders
    set branch_id = p_target_branch_id, order_number = v_number
    where id = v_order.id;
  update public.delivery_order_events set branch_id = p_target_branch_id where order_id = v_order.id;
  update public.delivery_notifications set branch_id = p_target_branch_id where order_id = v_order.id;
  update public.delivery_recording_voids set branch_id = p_target_branch_id where order_id = v_order.id;
  select to_jsonb(o) into v_after from public.delivery_orders o where o.id = v_order.id;
  insert into public.admin_record_corrections(actor_id,action,target_id,reason,before_row,after_row)
    values(auth.uid(),'move_delivery_order',v_order.id,btrim(p_reason),v_before,v_after);
  return jsonb_build_object('order_number',v_number,
    'benefit_pay_serial',(select serial_number from public.benefit_pay_transfers where delivery_order_id = v_order.id));
end $$;

create or replace function public.app_admin_restore_delivery_order(
  p_order_id uuid, p_reason text
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_order public.delivery_orders%rowtype;
  v_after jsonb;
begin
  if public.current_app_role() <> 'admin' or auth.uid() is null then
    raise exception 'Admin account required' using errcode = '42501';
  end if;
  if length(btrim(coalesce(p_reason, ''))) < 5 then
    raise exception 'A correction reason of at least 5 characters is required';
  end if;
  select * into v_order from public.delivery_orders where id = p_order_id for update;
  if not found or v_order.delivery_status <> 'cancelled'
    or v_order.cancelled_reason not like 'Recorded only void:%'
    or v_order.deleted_at is not null then
    raise exception 'Only a voided recorded-only order can be restored';
  end if;
  update public.delivery_orders
    set delivery_status = 'recorded', cancelled_at = null, cancelled_reason = null
    where id = v_order.id;
  select to_jsonb(o) into v_after from public.delivery_orders o where o.id = v_order.id;
  insert into public.delivery_order_events
    (order_id,branch_id,event_type,previous_status,new_status,actor_user_id,actor_role,notes,order_snapshot)
    values(v_order.id,v_order.branch_id,'recorded','cancelled','recorded',
      auth.uid(),'admin',btrim(p_reason),v_after);
  insert into public.admin_record_corrections(actor_id,action,target_id,reason,before_row,after_row)
    values(auth.uid(),'restore_delivery_order',v_order.id,btrim(p_reason),to_jsonb(v_order),v_after);
  return jsonb_build_object('order_number',v_order.order_number,'status','recorded');
end $$;

create or replace function public.app_admin_move_manual_benefit_pay(
  p_transfer_id uuid, p_target_branch_id uuid, p_reason text
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_row public.benefit_pay_transfers%rowtype;
  v_after jsonb;
begin
  if public.current_app_role() <> 'admin' or auth.uid() is null then
    raise exception 'Admin account required' using errcode = '42501';
  end if;
  if length(btrim(coalesce(p_reason, ''))) < 5 then raise exception 'Correction reason required'; end if;
  select * into v_row from public.benefit_pay_transfers where id = p_transfer_id for update;
  if not found or v_row.source <> 'manual' then
    raise exception 'Only manual Benefit Pay transfers can be moved here';
  end if;
  if v_row.branch_id = p_target_branch_id or not exists
    (select 1 from public.branches where id = p_target_branch_id and role = 'branch') then
    raise exception 'Invalid target branch';
  end if;
  if v_row.pharmacist_id is not null and not exists (
    select 1 from public.pharmacist_branches
    where pharmacist_id = v_row.pharmacist_id and branch_id = p_target_branch_id
  ) then
    raise exception 'Pharmacist is not assigned to the target branch';
  end if;
  update public.benefit_pay_transfers b
    set branch_id = p_target_branch_id,
        sequence_no = public.benefit_pay_next_sequence(p_target_branch_id,b.transfer_date)
    where id = v_row.id;
  select to_jsonb(b) into v_after from public.benefit_pay_transfers b where b.id = v_row.id;
  insert into public.admin_record_corrections(actor_id,action,target_id,reason,before_row,after_row)
    values(auth.uid(),'move_manual_benefit_pay',v_row.id,btrim(p_reason),to_jsonb(v_row),v_after);
  return jsonb_build_object('serial_number',v_after->>'serial_number');
end $$;

create or replace function public.app_admin_restore_manual_benefit_pay(
  p_transfer_id uuid, p_reason text
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_archive public.benefit_pay_deleted_transfers%rowtype;
  v_row public.benefit_pay_transfers%rowtype;
  v_after jsonb;
begin
  if public.current_app_role() <> 'admin' or auth.uid() is null then
    raise exception 'Admin account required' using errcode = '42501';
  end if;
  if length(btrim(coalesce(p_reason, ''))) < 5 then raise exception 'Correction reason required'; end if;
  select * into v_archive from public.benefit_pay_deleted_transfers
    where transfer_id = p_transfer_id and restored_at is null for update;
  if not found or v_archive.snapshot->>'source' <> 'manual' then
    raise exception 'Deleted manual transfer not found';
  end if;
  if exists (select 1 from public.benefit_pay_transfers where id = p_transfer_id) then
    raise exception 'Transfer already exists';
  end if;
  v_row := jsonb_populate_record(null::public.benefit_pay_transfers,v_archive.snapshot);
  insert into public.benefit_pay_transfers
    (id,branch_id,transfer_date,pharmacist_id,pharmacist_name,transfer_type,
     value_bhd,transfer_time,source,notes,created_by,created_at,sequence_no)
  values
    (v_row.id,v_row.branch_id,v_row.transfer_date,v_row.pharmacist_id,
     v_row.pharmacist_name,v_row.transfer_type,v_row.value_bhd,v_row.transfer_time,
     'manual',v_row.notes,v_row.created_by,v_row.created_at,
     public.benefit_pay_next_sequence(v_row.branch_id,v_row.transfer_date));
  update public.benefit_pay_deleted_transfers
    set restored_by = auth.uid(), restored_at = now() where transfer_id = p_transfer_id;
  select to_jsonb(b) into v_after from public.benefit_pay_transfers b where b.id = p_transfer_id;
  insert into public.admin_record_corrections(actor_id,action,target_id,reason,before_row,after_row)
    values(auth.uid(),'restore_manual_benefit_pay',p_transfer_id,btrim(p_reason),v_archive.snapshot,v_after);
  return jsonb_build_object('serial_number',v_after->>'serial_number');
end $$;

revoke all on function public.app_admin_move_delivery_order(uuid,uuid,text),
  public.app_admin_restore_delivery_order(uuid,text),
  public.app_admin_move_manual_benefit_pay(uuid,uuid,text),
  public.app_admin_restore_manual_benefit_pay(uuid,text)
  from public, anon;
grant execute on function public.app_admin_move_delivery_order(uuid,uuid,text),
  public.app_admin_restore_delivery_order(uuid,text),
  public.app_admin_move_manual_benefit_pay(uuid,uuid,text),
  public.app_admin_restore_manual_benefit_pay(uuid,text)
  to authenticated;
notify pgrst, 'reload schema';
commit;
