-- Small isolated database fixture for the Seller -> Driver import migration.
create role anon nologin;
create role authenticated nologin;
create role service_role nologin;
create schema auth;
create function auth.role() returns text language sql stable as $$
  select current_setting('request.jwt.claim.role', true)
$$;
create table public.branches (id uuid primary key, code text not null, role text not null);
create table public.delivery_drivers (
  id uuid primary key, is_active boolean not null, auth_user_id uuid
);
create table public.delivery_payment_types (
  code text primary key, label text not null, requires_block boolean not null,
  is_active boolean not null, sort_order integer not null
);
create table public.delivery_blocks (block_number text primary key, is_active boolean not null);
create table public.delivery_orders (
  id uuid primary key default gen_random_uuid(), order_number text not null unique,
  branch_id uuid not null references public.branches(id),
  driver_id uuid not null references public.delivery_drivers(id),
  order_date date not null, value_bhd numeric(10,3) not null,
  payment_type text not null, payment_collection_status text not null default 'paid',
  amount_received_bhd numeric(10,3) not null default 0,
  amount_to_collect_bhd numeric(10,3) not null default 0,
  pharmacist_name text, block_number text,
  notes text, order_kind text not null, delivery_status text not null,
  assigned_at timestamptz, lifecycle_updated_at timestamptz
);
create table public.delivery_order_events (
  id uuid primary key default gen_random_uuid(), order_id uuid not null,
  branch_id uuid not null, event_type text not null, previous_status text,
  new_status text not null, driver_id uuid, actor_role text,
  order_snapshot jsonb not null, metadata jsonb not null
);
create function public.delivery_driver_recompute_daily_stats(uuid, date)
returns void language sql as $$ select null::void $$;
create function public.test_normalize_payment() returns trigger language plpgsql as $$
begin
  if new.payment_collection_status = 'paid' then
    new.amount_received_bhd := new.value_bhd;
    new.amount_to_collect_bhd := 0;
  elsif new.payment_collection_status = 'collect_on_delivery' then
    new.amount_received_bhd := 0;
    new.amount_to_collect_bhd := new.value_bhd;
  elsif new.payment_collection_status = 'partial' then
    new.amount_to_collect_bhd := new.value_bhd - new.amount_received_bhd;
  else
    raise exception 'Unexpected payment status';
  end if;
  return new;
end;
$$;
create trigger test_normalize_payment before insert on public.delivery_orders
for each row execute function public.test_normalize_payment();
insert into public.branches values
  ('00000000-0000-4000-8000-000000000001', 'BH01', 'branch');
insert into public.delivery_drivers values
  ('00000000-0000-4000-8000-000000000011', true, gen_random_uuid()),
  ('00000000-0000-4000-8000-000000000012', true, gen_random_uuid()),
  ('00000000-0000-4000-8000-000000000013', false, gen_random_uuid());
insert into public.delivery_payment_types values
  ('CASH', 'Cash', true, true, 20),
  ('CARD', 'Card', true, true, 30);
insert into public.delivery_blocks values ('101', true);
