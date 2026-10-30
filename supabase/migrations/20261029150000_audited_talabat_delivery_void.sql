create table if not exists public.delivery_recording_voids (
  id uuid primary key default gen_random_uuid(),
  order_id uuid unique references public.delivery_orders(id) on delete set null,
  branch_id uuid not null references public.branches(id) on delete restrict,
  order_snapshot jsonb not null,
  reason text not null check (length(btrim(reason)) between 3 and 500),
  voided_by uuid references auth.users(id) on delete set null,
  voided_at timestamptz not null default now()
);

alter table public.delivery_recording_voids enable row level security;
revoke all on public.delivery_recording_voids from public, anon, authenticated;
grant select on public.delivery_recording_voids to authenticated;
grant all on public.delivery_recording_voids to service_role;

drop policy if exists "delivery recording voids branch select" on public.delivery_recording_voids;
create policy "delivery recording voids branch select"
on public.delivery_recording_voids
for select to authenticated
using (public.current_app_can_access_branch(branch_id));

create or replace function public.app_delivery_void_talabat_order(
  p_order_id uuid,
  p_reason text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.delivery_orders%rowtype;
  v_reason text := btrim(coalesce(p_reason, ''));
  v_actor_role text := public.current_app_role();
  v_can_manage boolean := public.current_app_can_manage();
begin
  if auth.uid() is null then
    raise exception 'Authentication required to void Talabat delivery records'
      using errcode = '42501';
  end if;
  if p_order_id is null then
    raise exception 'Delivery order is required' using errcode = '22023';
  end if;
  if length(v_reason) < 3 or length(v_reason) > 500 then
    raise exception 'Enter a void reason between 3 and 500 characters' using errcode = '22023';
  end if;

  select * into v_order
  from public.delivery_orders
  where id = p_order_id
  for update;
  if not found then return true; end if;

  if upper(btrim(coalesce(v_order.payment_type, ''))) <> 'TALABAT'
    and lower(btrim(coalesce(v_order.external_source, ''))) <> 'talabat' then
    raise exception 'Only Talabat delivery orders can be voided with this action'
      using errcode = '42501';
  end if;

  if not v_can_manage and (coalesce(v_actor_role, '') <> 'branch'
    or public.current_app_branch_id() is distinct from v_order.branch_id) then
    raise exception 'Only administrators or the owning branch can void this Talabat record'
      using errcode = '42501';
  end if;

  insert into public.delivery_recording_voids (
    order_id, branch_id, order_snapshot, reason, voided_by
  ) values (
    v_order.id, v_order.branch_id, to_jsonb(v_order), v_reason, auth.uid()
  ) on conflict (order_id) do nothing;

  return true;
end;
$$;

revoke all on function public.app_delivery_void_talabat_order(uuid, text) from public, anon;
grant execute on function public.app_delivery_void_talabat_order(uuid, text) to authenticated;
notify pgrst, 'reload schema';
