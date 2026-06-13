-- Cash Flow Planner schema.
-- Earlier local builds carried this schema under db/migrations only, so linked
-- Supabase projects can miss the finance tables and show Command Center warnings.

create table if not exists public.suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  flexibility_level text not null default 'Medium' check (flexibility_level in ('High', 'Medium', 'Low')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.cheques (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid references public.suppliers(id) on delete cascade,
  cheque_number text not null,
  amount numeric(15, 3) not null,
  due_date date not null,
  priority text not null default 'Normal' check (priority in ('Critical', 'Normal', 'Flexible')),
  status text not null default 'Scheduled' check (status in ('Scheduled', 'Paid', 'Delayed')),
  delay_reason text,
  execution_time text not null default '09:00',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  category text not null,
  amount numeric(15, 3) not null,
  expense_date date not null,
  type text not null default 'Variable' check (type in ('Fixed', 'Variable')),
  delay_allowed boolean not null default true,
  max_delay_days integer not null default 0,
  priority text not null default 'Medium' check (priority in ('High', 'Medium', 'Low')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.revenues_actual (
  id uuid primary key default gen_random_uuid(),
  revenue_date date not null,
  amount numeric(15, 3) not null,
  payment_type text not null default 'Cash' check (payment_type in ('Cash', 'Visa')),
  settlement_time text not null default '13:00',
  created_at timestamptz not null default now()
);

create table if not exists public.revenues_expected (
  id uuid primary key default gen_random_uuid(),
  expected_date date not null,
  expected_amount numeric(15, 3) not null,
  confidence text not null default 'Medium' check (confidence in ('High', 'Medium', 'Low')),
  expected_time text not null default '13:00',
  reason text,
  created_at timestamptz not null default now()
);

create table if not exists public.cash_flow_settings (
  id text primary key,
  safe_threshold numeric(15, 3) not null default 1000,
  initial_balance numeric(15, 3) not null default 0,
  forecast_horizon integer not null default 30,
  updated_at timestamptz not null default now()
);

alter table public.cheques add column if not exists execution_time text not null default '09:00';
alter table public.revenues_actual add column if not exists settlement_time text not null default '13:00';
alter table public.revenues_expected add column if not exists expected_time text not null default '13:00';

insert into public.cash_flow_settings (id, safe_threshold, initial_balance, forecast_horizon)
values ('global', 1000, 0, 30)
on conflict (id) do nothing;

create index if not exists cheques_due_date_idx on public.cheques(due_date);
create index if not exists expenses_expense_date_idx on public.expenses(expense_date);
create index if not exists revenues_actual_date_idx on public.revenues_actual(revenue_date);
create index if not exists revenues_expected_date_idx on public.revenues_expected(expected_date);

alter table public.suppliers enable row level security;
alter table public.cheques enable row level security;
alter table public.expenses enable row level security;
alter table public.revenues_actual enable row level security;
alter table public.revenues_expected enable row level security;
alter table public.cash_flow_settings enable row level security;

revoke all on public.suppliers from anon;
revoke all on public.cheques from anon;
revoke all on public.expenses from anon;
revoke all on public.revenues_actual from anon;
revoke all on public.revenues_expected from anon;
revoke all on public.cash_flow_settings from anon;

grant select, insert, update, delete on public.suppliers to authenticated;
grant select, insert, update, delete on public.cheques to authenticated;
grant select, insert, update, delete on public.expenses to authenticated;
grant select, insert, update, delete on public.revenues_actual to authenticated;
grant select, insert, update, delete on public.revenues_expected to authenticated;
grant select, insert, update, delete on public.cash_flow_settings to authenticated;

grant all on public.suppliers to service_role;
grant all on public.cheques to service_role;
grant all on public.expenses to service_role;
grant all on public.revenues_actual to service_role;
grant all on public.revenues_expected to service_role;
grant all on public.cash_flow_settings to service_role;

do $$
declare
  table_name text;
begin
  foreach table_name in array array['suppliers','cheques','expenses','revenues_actual','revenues_expected','cash_flow_settings']
  loop
    execute format('drop policy if exists "Authenticated users can select %s" on public.%I', table_name, table_name);
    execute format('drop policy if exists "Authenticated users can insert %s" on public.%I', table_name, table_name);
    execute format('drop policy if exists "Authenticated users can update %s" on public.%I', table_name, table_name);
    execute format('drop policy if exists "%s select authenticated" on public.%I', table_name, table_name);
    execute format('drop policy if exists "%s manage authenticated" on public.%I', table_name, table_name);
    execute format('create policy "%s select authenticated" on public.%I for select to authenticated using (public.current_app_can_read_all())', table_name, table_name);
    execute format('create policy "%s manage authenticated" on public.%I for all to authenticated using (public.current_app_can_manage()) with check (public.current_app_can_manage())', table_name, table_name);
  end loop;
end $$;

notify pgrst, 'reload schema';
