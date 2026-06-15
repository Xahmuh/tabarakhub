-- Configurable delivery payment types.
-- Adds Insurance and lets admins manage future payment channels without
-- replacing delivery_orders or weakening existing branch-scoped RLS.

create table if not exists public.delivery_payment_types (
  code text primary key,
  label text not null,
  requires_block boolean not null default true,
  is_active boolean not null default true,
  sort_order integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  constraint delivery_payment_types_code_format
    check (code = upper(code) and code ~ '^[A-Z0-9][A-Z0-9_-]{0,39}$'),
  constraint delivery_payment_types_label_present
    check (btrim(label) <> '')
);

insert into public.delivery_payment_types (code, label, requires_block, is_active, sort_order)
values
  ('BP', 'BP', true, true, 10),
  ('CASH', 'Cash', true, true, 20),
  ('CARD', 'Card', true, true, 30),
  ('TALABAT', 'Talabat', false, true, 40),
  ('INSURANCE', 'Insurance', true, true, 50)
on conflict (code) do update
set
  label = excluded.label,
  requires_block = excluded.requires_block,
  sort_order = excluded.sort_order,
  updated_at = now();

create or replace function public.touch_delivery_payment_type()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.code := upper(btrim(new.code));
  new.label := btrim(new.label);
  new.updated_by := auth.uid();
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists touch_delivery_payment_type on public.delivery_payment_types;
create trigger touch_delivery_payment_type
before insert or update on public.delivery_payment_types
for each row execute function public.touch_delivery_payment_type();

alter table public.delivery_payment_types enable row level security;
revoke all on public.delivery_payment_types from anon;
revoke all on public.delivery_payment_types from authenticated;
grant select, insert, update, delete on public.delivery_payment_types to authenticated;
grant all on public.delivery_payment_types to service_role;

drop policy if exists "delivery payment types select" on public.delivery_payment_types;
create policy "delivery payment types select"
on public.delivery_payment_types
for select
to authenticated
using (is_active = true or public.current_app_can_manage());

drop policy if exists "delivery payment types manage" on public.delivery_payment_types;
create policy "delivery payment types manage"
on public.delivery_payment_types
for all
to authenticated
using (public.current_app_can_manage())
with check (public.current_app_can_manage());

alter table public.delivery_orders
  drop constraint if exists delivery_orders_payment_type_check;

alter table public.delivery_orders
  drop constraint if exists delivery_orders_block_required_unless_talabat;

alter table public.delivery_orders
  drop constraint if exists delivery_orders_payment_type_format_check;

alter table public.delivery_orders
  add constraint delivery_orders_payment_type_format_check
  check (payment_type = upper(payment_type) and payment_type ~ '^[A-Z0-9][A-Z0-9_-]{0,39}$') not valid;

alter table public.delivery_orders
  validate constraint delivery_orders_payment_type_format_check;

create or replace function public.delivery_orders_resolve_geo()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  block_rec record;
  branch_gov text;
  payment_rec record;
begin
  new.payment_type := upper(btrim(new.payment_type));

  select code, label, requires_block, is_active
  into payment_rec
  from public.delivery_payment_types
  where code = new.payment_type;

  if not found then
    raise exception 'Payment type % is not configured', new.payment_type
      using errcode = '23514';
  end if;

  if payment_rec.is_active is not true
    and (tg_op = 'INSERT' or old.payment_type is distinct from new.payment_type) then
    raise exception 'Payment type % is inactive', new.payment_type
      using errcode = '23514';
  end if;

  if payment_rec.requires_block is not true then
    new.block_number := null;
    new.area_name := null;
    new.governorate := null;
    new.is_outside_governorate := false;
    return new;
  end if;

  new.block_number := nullif(btrim(new.block_number), '');

  if new.block_number is null then
    raise exception 'Block number is required for % delivery orders', payment_rec.label
      using errcode = '23514';
  end if;

  select area_name, governorate into block_rec
  from public.delivery_blocks
  where block_number = new.block_number;

  if found then
    new.area_name := block_rec.area_name;
    new.governorate := block_rec.governorate;
  end if;

  select governorate into branch_gov
  from public.branch_classifications
  where branch_id = new.branch_id;

  new.is_outside_governorate :=
    new.governorate is not null
    and branch_gov is not null
    and new.governorate <> branch_gov;

  return new;
end;
$$;

revoke all on function public.touch_delivery_payment_type() from public, anon, authenticated;
grant execute on function public.touch_delivery_payment_type() to service_role;

revoke all on function public.delivery_orders_resolve_geo() from public, anon, authenticated;
grant execute on function public.delivery_orders_resolve_geo() to service_role;

notify pgrst, 'reload schema';
