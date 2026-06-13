-- Delivery Recording & Traceability module.
-- Branch users record delivery orders; managers administer drivers, blocks,
-- branch classifications, and cost settings; analytics are RLS-scoped.

-- 1. Reference tables -----------------------------------------------------------------

create table if not exists public.delivery_blocks (
  block_number text primary key,
  area_name text not null,
  governorate text not null check (governorate in ('Capital', 'Muharraq', 'Northern', 'Southern')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

create table if not exists public.delivery_drivers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

create unique index if not exists delivery_drivers_active_name_idx
on public.delivery_drivers (lower(name))
where is_active;

create table if not exists public.branch_classifications (
  branch_id uuid primary key references public.branches(id) on delete cascade,
  area text,
  supervisor_name text,
  supervisor_user_id uuid references auth.users(id) on delete set null,
  governorate text check (governorate is null or governorate in ('Capital', 'Muharraq', 'Northern', 'Southern')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

create table if not exists public.delivery_cost_settings (
  id uuid primary key default gen_random_uuid(),
  driver_id uuid unique references public.delivery_drivers(id) on delete cascade,
  monthly_cost_bhd numeric(10,3) not null check (monthly_cost_bhd >= 0),
  working_days_per_month integer not null default 26 check (working_days_per_month between 1 and 31),
  target_orders_per_day numeric(6,2) not null default 15 check (target_orders_per_day > 0),
  assumed_margin_pct numeric(5,2) check (assumed_margin_pct is null or (assumed_margin_pct >= 0 and assumed_margin_pct <= 100)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

-- 2. Orders + audit -------------------------------------------------------------------

create table if not exists public.delivery_orders (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.branches(id) on delete restrict,
  order_date date not null default current_date,
  value_bhd numeric(10,3) not null check (value_bhd > 0),
  payment_type text not null check (payment_type in ('BP', 'CARD', 'CASH', 'TALABAT')),
  pharmacist_id uuid references public.pharmacists(id) on delete set null,
  pharmacist_name text,
  driver_id uuid references public.delivery_drivers(id) on delete set null,
  -- Intentionally NOT a foreign key: branches may record blocks that are not in the
  -- directory yet ("Save anyway" flow); the data-quality panel surfaces them as
  -- "Unknown block" (block_number set, area_name null) for the manager to add.
  block_number text,
  area_name text,
  governorate text,
  is_outside_governorate boolean not null default false,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  constraint delivery_orders_block_required_unless_talabat
    check (payment_type = 'TALABAT' or block_number is not null)
);

-- Existing deployments may already have an older delivery_orders table that
-- used business_date/order_value/payment_method. CREATE TABLE IF NOT EXISTS
-- does not add missing columns, so align that legacy shape before indexes,
-- triggers, policies, and new app queries reference the new columns.
alter table public.delivery_orders add column if not exists order_date date;
alter table public.delivery_orders add column if not exists value_bhd numeric(10,3);
alter table public.delivery_orders add column if not exists payment_type text;
alter table public.delivery_orders add column if not exists area_name text;
alter table public.delivery_orders add column if not exists governorate text;
alter table public.delivery_orders add column if not exists is_outside_governorate boolean not null default false;
alter table public.delivery_orders add column if not exists created_by uuid references auth.users(id) on delete set null;
alter table public.delivery_orders add column if not exists updated_by uuid references auth.users(id) on delete set null;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'delivery_orders' and column_name = 'business_date'
  ) then
    execute 'update public.delivery_orders set order_date = coalesce(order_date, business_date) where order_date is null';
    execute 'alter table public.delivery_orders alter column business_date drop not null';
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'delivery_orders' and column_name = 'order_value'
  ) then
    execute 'update public.delivery_orders set value_bhd = coalesce(value_bhd, order_value) where value_bhd is null';
    execute 'alter table public.delivery_orders alter column order_value drop not null';
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'delivery_orders' and column_name = 'payment_method'
  ) then
    execute $sql$
      update public.delivery_orders
      set payment_type = coalesce(
        payment_type,
        case upper(payment_method::text)
          when 'BP' then 'BP'
          when 'COD' then 'CASH'
          when 'CREDIT' then 'CARD'
          when 'INSURANCE' then 'CARD'
          else 'CASH'
        end
      )
      where payment_type is null
    $sql$;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'delivery_orders' and column_name = 'order_type'
  ) then
    execute 'alter table public.delivery_orders alter column order_type drop not null';
  end if;
end $$;

update public.delivery_orders set order_date = current_date where order_date is null;
update public.delivery_orders set value_bhd = 0.001 where value_bhd is null;
update public.delivery_orders set payment_type = 'CASH' where payment_type is null;

alter table public.delivery_orders alter column order_date set default current_date;
alter table public.delivery_orders alter column order_date set not null;
alter table public.delivery_orders alter column value_bhd set not null;
alter table public.delivery_orders alter column payment_type set not null;
alter table public.delivery_orders alter column pharmacist_id drop not null;
alter table public.delivery_orders alter column pharmacist_name drop not null;

alter table public.delivery_orders drop constraint if exists delivery_orders_driver_id_fkey;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'delivery_orders_driver_id_fkey'
      and conrelid = 'public.delivery_orders'::regclass
  ) then
    alter table public.delivery_orders
      add constraint delivery_orders_driver_id_fkey
      foreign key (driver_id) references public.delivery_drivers(id) on delete set null not valid;
  end if;

  -- Unknown blocks must be recordable (data-quality flow), so block_number is not an FK.
  -- Drop it if an earlier deployment created it.
  alter table public.delivery_orders drop constraint if exists delivery_orders_block_number_fkey;

  if not exists (
    select 1 from pg_constraint
    where conname = 'delivery_orders_payment_type_check'
      and conrelid = 'public.delivery_orders'::regclass
  ) then
    alter table public.delivery_orders
      add constraint delivery_orders_payment_type_check
      check (payment_type in ('BP', 'CARD', 'CASH', 'TALABAT')) not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'delivery_orders_value_bhd_check'
      and conrelid = 'public.delivery_orders'::regclass
  ) then
    alter table public.delivery_orders
      add constraint delivery_orders_value_bhd_check
      check (value_bhd > 0) not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'delivery_orders_block_required_unless_talabat'
      and conrelid = 'public.delivery_orders'::regclass
  ) then
    alter table public.delivery_orders
      add constraint delivery_orders_block_required_unless_talabat
      check (payment_type = 'TALABAT' or block_number is not null) not valid;
  end if;
end $$;

create index if not exists delivery_orders_branch_date_idx on public.delivery_orders(branch_id, order_date);
create index if not exists delivery_orders_date_idx on public.delivery_orders(order_date);
create index if not exists delivery_orders_driver_idx on public.delivery_orders(driver_id);
create index if not exists delivery_orders_pharmacist_idx on public.delivery_orders(pharmacist_id);
create index if not exists delivery_orders_payment_idx on public.delivery_orders(payment_type);
create index if not exists delivery_orders_block_idx on public.delivery_orders(block_number);
create index if not exists delivery_orders_outside_idx on public.delivery_orders(is_outside_governorate) where is_outside_governorate;

create table if not exists public.delivery_order_audit_logs (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null,
  action text not null check (action in ('update', 'delete')),
  old_row jsonb not null,
  changed_by uuid,
  changed_at timestamptz not null default now()
);

create index if not exists delivery_order_audit_logs_order_idx on public.delivery_order_audit_logs(order_id);

-- 3. Geo resolution + audit triggers ---------------------------------------------------

create or replace function public.delivery_orders_resolve_geo()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  block_rec record;
  branch_gov text;
begin
  if new.payment_type = 'TALABAT' then
    new.block_number := null;
    new.area_name := null;
    new.governorate := null;
    new.is_outside_governorate := false;
    return new;
  end if;

  if new.block_number is not null then
    select area_name, governorate into block_rec
    from public.delivery_blocks
    where block_number = new.block_number;

    if found then
      new.area_name := block_rec.area_name;
      new.governorate := block_rec.governorate;
    end if;
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

drop trigger if exists delivery_orders_resolve_geo_trigger on public.delivery_orders;
create trigger delivery_orders_resolve_geo_trigger
before insert or update on public.delivery_orders
for each row execute function public.delivery_orders_resolve_geo();

create or replace function public.delivery_orders_audit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' then
    insert into public.delivery_order_audit_logs (order_id, action, old_row, changed_by)
    values (old.id, 'update', to_jsonb(old), auth.uid());
    return new;
  elsif tg_op = 'DELETE' then
    insert into public.delivery_order_audit_logs (order_id, action, old_row, changed_by)
    values (old.id, 'delete', to_jsonb(old), auth.uid());
    return old;
  end if;
  return null;
end;
$$;

drop trigger if exists delivery_orders_audit_trigger on public.delivery_orders;
create trigger delivery_orders_audit_trigger
after update or delete on public.delivery_orders
for each row execute function public.delivery_orders_audit();

-- 4. Seed block/area/governorate reference data ----------------------------------------

insert into public.delivery_blocks (block_number, area_name, governorate) values
  ('746', 'Aáli', 'Southern'),
  ('748', 'Aáli', 'Southern'),
  ('965', 'Al Door', 'Southern'),
  ('961', 'Algainah', 'Southern'),
  ('929', 'Al Hajyat', 'Southern'),
  ('931', 'Al Hajyat', 'Southern'),
  ('935', 'Al Hajyat', 'Southern'),
  ('939', 'Al Hajyat', 'Southern'),
  ('901', 'Al Hunaniya', 'Southern'),
  ('903', 'Al Hunaniya', 'Southern'),
  ('971', 'Al Jaseera', 'Southern'),
  ('1099', 'Al Mamtala', 'Southern'),
  ('943', 'Al Mazrooeeah', 'Southern'),
  ('949', 'Al Moaaskar', 'Southern'),
  ('988', 'Al Omar', 'Southern'),
  ('983', 'Al Qarah', 'Southern'),
  ('987', 'Al Qarah', 'Southern'),
  ('967', 'Al Qareen', 'Southern'),
  ('906', 'Al Rawdha', 'Southern'),
  ('930', 'Al Rawdha', 'Southern'),
  ('947', 'Al Riffah', 'Southern'),
  ('995', 'Al Romaitha', 'Southern'),
  ('981', 'Al Rumamin', 'Southern'),
  ('982', 'Al Rumamin', 'Southern'),
  ('989', 'Al Shabak', 'Southern'),
  ('951', 'Askar', 'Southern'),
  ('945', 'Awali', 'Southern'),
  ('946', 'Awali', 'Southern'),
  ('1063', 'Belaj Al Jazair', 'Southern'),
  ('1064', 'Belaj Al Jazair', 'Southern'),
  ('913', 'Bu Kuwarah', 'Southern'),
  ('917', 'Bu Kuwarah', 'Southern'),
  ('919', 'Bu Kuwarah', 'Southern'),
  ('921', 'Bu Kuwarah', 'Southern'),
  ('923', 'Bu Kuwarah', 'Southern'),
  ('925', 'Bu Kuwarah', 'Southern'),
  ('927', 'Bu Kuwarah', 'Southern'),
  ('1048', 'Dar Kulaib', 'Southern'),
  ('999', 'Durrat Al Bahrain', 'Southern'),
  ('905', 'East Riffa', 'Southern'),
  ('907', 'East Riffa', 'Southern'),
  ('909', 'East Riffa', 'Southern'),
  ('911', 'East Riffa', 'Southern'),
  ('959', 'Hafeera', 'Southern'),
  ('645', 'Hawrat Sanad', 'Southern'),
  ('973', 'Hidd Al Jamal', 'Southern'),
  ('1067', 'Hlaitan', 'Southern'),
  ('1062', 'Horat Anaqa', 'Southern'),
  ('801', 'Isa Town', 'Southern'),
  ('802', 'Isa Town', 'Southern'),
  ('803', 'Isa Town', 'Southern'),
  ('804', 'Isa Town', 'Southern'),
  ('805', 'Isa Town', 'Southern'),
  ('806', 'Isa Town', 'Southern'),
  ('807', 'Isa Town', 'Southern'),
  ('808', 'Isa Town', 'Southern'),
  ('809', 'Isa Town', 'Southern'),
  ('810', 'Isa Town', 'Southern'),
  ('812', 'Isa Town', 'Southern'),
  ('813', 'Isa Town', 'Southern'),
  ('814', 'Isa Town', 'Southern'),
  ('840', 'Isa Town', 'Southern'),
  ('841', 'Isa Town', 'Southern'),
  ('920', 'Jari Al Shaikh', 'Southern'),
  ('924', 'Jari Al Shaikh', 'Southern'),
  ('926', 'Jari Al Shaikh', 'Southern'),
  ('957', 'Jaw', 'Southern'),
  ('960', 'Jaw', 'Southern'),
  ('1061', 'Jazaer Beach', 'Southern'),
  ('613', 'Juzur Al Dar', 'Southern'),
  ('948', 'Lhassay', 'Southern'),
  ('635', 'Maameer', 'Southern'),
  ('636', 'Maameer', 'Southern'),
  ('1069', 'Mamlahat Al Mamtala', 'Southern'),
  ('1070', 'Mamlahat Al Mamtala', 'Southern'),
  ('953', 'Mazraa', 'Southern'),
  ('1101', 'New districts', 'Southern'),
  ('1102', 'New districts', 'Southern'),
  ('1103', 'New districts', 'Southern'),
  ('1104', 'New districts', 'Southern'),
  ('1106', 'New districts', 'Southern'),
  ('1107', 'New districts', 'Southern'),
  ('1108', 'New districts', 'Southern'),
  ('1110', 'New districts', 'Southern'),
  ('1111', 'New districts', 'Southern'),
  ('1112', 'New districts', 'Southern'),
  ('1113', 'New districts', 'Southern'),
  ('918', 'New districts', 'Southern'),
  ('932', 'New districts', 'Southern'),
  ('944', 'New districts', 'Southern'),
  ('950', 'New districts', 'Southern'),
  ('955', 'New districts', 'Southern'),
  ('643', 'Nuwaydirat', 'Southern'),
  ('646', 'Nuwaydirat', 'Southern'),
  ('954', 'Ras Abu Jarjor', 'Southern'),
  ('958', 'Ras Hayan', 'Southern'),
  ('952', 'Ras Zuwaid', 'Southern'),
  ('914', 'Riffa / Albuhair', 'Southern'),
  ('915', 'Riffa / Albuhair', 'Southern'),
  ('916', 'Riffa / Albuhair', 'Southern'),
  ('922', 'Riffa / Albuhair', 'Southern'),
  ('933', 'Riffa / Albuhair', 'Southern'),
  ('934', 'Riffa / Albuhair', 'Southern'),
  ('937', 'Riffa / Albuhair', 'Southern'),
  ('941', 'Riffa / Albuhair', 'Southern'),
  ('976', 'Sukhair', 'Southern'),
  ('985', 'Sukhair', 'Southern'),
  ('942', 'Swayfra', 'Southern'),
  ('998', 'Trafi', 'Southern'),
  ('614', 'Um Albaidh', 'Southern'),
  ('615', 'Um Albaidh', 'Southern'),
  ('616', 'Um Albaidh', 'Southern'),
  ('986', 'Um Jadir', 'Southern'),
  ('997', 'Umm Jidr Al Summan', 'Southern'),
  ('1068', 'Wadi Ali', 'Southern'),
  ('928', 'Wadi Al Sale', 'Southern'),
  ('902', 'West Riffa', 'Southern'),
  ('904', 'West Riffa', 'Southern'),
  ('908', 'West Riffa', 'Southern'),
  ('910', 'West Riffa', 'Southern'),
  ('912', 'West Riffa', 'Southern'),
  ('1051', 'Zallaq', 'Southern'),
  ('1052', 'Zallaq', 'Southern'),
  ('1054', 'Zallaq', 'Southern'),
  ('1055', 'Zallaq', 'Southern'),
  ('1056', 'Zallaq', 'Southern'),
  ('718', 'Zayed Town', 'Southern'),
  ('720', 'Zayed Town', 'Southern'),
  ('732', 'Aáli', 'Northern'),
  ('734', 'Aáli', 'Northern'),
  ('736', 'Aáli', 'Northern'),
  ('738', 'Aáli', 'Northern'),
  ('740', 'Aáli', 'Northern'),
  ('742', 'Aáli', 'Northern'),
  ('744', 'Aáli', 'Northern'),
  ('469', 'Abu Saiba''a', 'Northern'),
  ('471', 'Abu Saiba''a', 'Northern'),
  ('473', 'Abu Saiba''a', 'Northern'),
  ('475', 'Abu Saiba''a', 'Northern'),
  ('463', 'Al Hajar', 'Northern'),
  ('465', 'Al Hajar', 'Northern'),
  ('1001', 'Al Jasra', 'Northern'),
  ('1002', 'Al Jasra', 'Northern'),
  ('1003', 'Al Jasra', 'Northern'),
  ('1004', 'Al Jasra', 'Northern'),
  ('1006', 'Al Jasra', 'Northern'),
  ('1016', 'Al Lawzi', 'Northern'),
  ('1018', 'Al Lawzi', 'Northern'),
  ('1020', 'Al Lawzi', 'Northern'),
  ('587', 'Al Muhamadyia', 'Northern'),
  ('477', 'Al Shakhura', 'Northern'),
  ('479', 'Al Shakhura', 'Northern'),
  ('481', 'Al Shakhura', 'Northern'),
  ('537', 'Bani Jamra', 'Northern'),
  ('539', 'Bani Jamra', 'Northern'),
  ('541', 'Bani Jamra', 'Northern'),
  ('543', 'Bani Jamra', 'Northern'),
  ('518', 'Barbar', 'Northern'),
  ('520', 'Barbar', 'Northern'),
  ('522', 'Barbar', 'Northern'),
  ('524', 'Barbar', 'Northern'),
  ('526', 'Barbar', 'Northern'),
  ('528', 'Barbar', 'Northern'),
  ('530', 'Barbar', 'Northern'),
  ('550', 'Budaiya', 'Northern'),
  ('552', 'Budaiya', 'Northern'),
  ('553', 'Budaiya', 'Northern'),
  ('555', 'Budaiya', 'Northern'),
  ('557', 'Budaiya', 'Northern'),
  ('559', 'Budaiya', 'Northern'),
  ('455', 'Buqwa', 'Northern'),
  ('457', 'Buqwa', 'Northern'),
  ('752', 'Buri', 'Northern'),
  ('754', 'Buri', 'Northern'),
  ('756', 'Buri', 'Northern'),
  ('758', 'Buri', 'Northern'),
  ('760', 'Buri', 'Northern'),
  ('762', 'Buri', 'Northern'),
  ('1017', 'Damistan', 'Northern'),
  ('1019', 'Damistan', 'Northern'),
  ('1022', 'Damistan', 'Northern'),
  ('1046', 'Dar Kulaib', 'Northern'),
  ('536', 'Diraz', 'Northern'),
  ('538', 'Diraz', 'Northern'),
  ('540', 'Diraz', 'Northern'),
  ('542', 'Diraz', 'Northern'),
  ('544', 'Diraz', 'Northern'),
  ('1038', 'Hamad Town', 'Northern'),
  ('1203', 'Hamad Town', 'Northern'),
  ('1204', 'Hamad Town', 'Northern'),
  ('1205', 'Hamad Town', 'Northern'),
  ('1206', 'Hamad Town', 'Northern'),
  ('1207', 'Hamad Town', 'Northern'),
  ('1208', 'Hamad Town', 'Northern'),
  ('1209', 'Hamad Town', 'Northern'),
  ('1210', 'Hamad Town', 'Northern'),
  ('1211', 'Hamad Town', 'Northern'),
  ('1212', 'Hamad Town', 'Northern'),
  ('1213', 'Hamad Town', 'Northern'),
  ('1214', 'Hamad Town', 'Northern'),
  ('1215', 'Hamad Town', 'Northern'),
  ('1216', 'Hamad Town', 'Northern'),
  ('1009', 'Hamala', 'Northern'),
  ('1010', 'Hamala', 'Northern'),
  ('1012', 'Hamala', 'Northern'),
  ('1014', 'Hamala', 'Northern'),
  ('444', 'Hillat AbdulSaleh', 'Northern'),
  ('714', 'Hoarat Aáli', 'Northern'),
  ('730', 'Hoarat Aáli', 'Northern'),
  ('431', 'Jabalt Hibshi', 'Northern'),
  ('433', 'Jabalt Hibshi', 'Northern'),
  ('435', 'Jabalt Hibshi', 'Northern'),
  ('561', 'Janabiya', 'Northern'),
  ('565', 'Janabiya', 'Northern'),
  ('569', 'Janabiya', 'Northern'),
  ('571', 'Janabiya', 'Northern'),
  ('575', 'Janabiya', 'Northern'),
  ('577', 'Janabiya', 'Northern'),
  ('579', 'Janabiya', 'Northern'),
  ('502', 'Jannusan', 'Northern'),
  ('504', 'Jannusan', 'Northern'),
  ('506', 'Jannusan', 'Northern'),
  ('508', 'Jannusan', 'Northern'),
  ('591', 'Jedah', 'Northern'),
  ('514', 'Jind Al Haj', 'Northern'),
  ('454', 'Karana', 'Northern'),
  ('456', 'Karana', 'Northern'),
  ('458', 'Karana', 'Northern'),
  ('460', 'Karana', 'Northern'),
  ('1025', 'Karzakan', 'Northern'),
  ('1026', 'Karzakan', 'Northern'),
  ('1027', 'Karzakan', 'Northern'),
  ('1028', 'Karzakan', 'Northern'),
  ('1095', 'King Fahad Causway', 'Northern'),
  ('505', 'Magaba', 'Northern'),
  ('507', 'Magaba', 'Northern'),
  ('509', 'Magaba', 'Northern'),
  ('513', 'Magaba', 'Northern'),
  ('1032', 'Malkiya', 'Northern'),
  ('1033', 'Malkiya', 'Northern'),
  ('1034', 'Malkiya', 'Northern'),
  ('450', 'Maqsha', 'Northern'),
  ('529', 'Markh', 'Northern'),
  ('531', 'Markh', 'Northern'),
  ('533', 'Markh', 'Northern'),
  ('1218', 'New districts', 'Northern'),
  ('515', 'New districts', 'Northern'),
  ('532', 'North City', 'Northern'),
  ('534', 'North City', 'Northern'),
  ('535', 'North City', 'Northern'),
  ('580', 'Northern City', 'Northern'),
  ('581', 'Northern City', 'Northern'),
  ('582', 'Northern City', 'Northern'),
  ('583', 'Northern City', 'Northern'),
  ('584', 'Northern City', 'Northern'),
  ('585', 'Northern City', 'Northern'),
  ('586', 'Northern City', 'Northern'),
  ('588', 'Northern City', 'Northern'),
  ('589', 'Northern City', 'Northern'),
  ('590', 'Northern City', 'Northern'),
  ('439', 'Northern Sehla', 'Northern'),
  ('441', 'Northern Sehla', 'Northern'),
  ('447', 'Qadam', 'Northern'),
  ('449', 'Qadam', 'Northern'),
  ('453', 'Qadam', 'Northern'),
  ('545', 'Quraya', 'Northern'),
  ('547', 'Quraya', 'Northern'),
  ('549', 'Quraya', 'Northern'),
  ('551', 'Quraya', 'Northern'),
  ('517', 'Saar', 'Northern'),
  ('521', 'Saar', 'Northern'),
  ('523', 'Saar', 'Northern'),
  ('525', 'Saar', 'Northern'),
  ('527', 'Saar', 'Northern'),
  ('1037', 'Sadaq', 'Northern'),
  ('1041', 'Safriya', 'Northern'),
  ('702', 'Salmabad', 'Northern'),
  ('704', 'Salmabad', 'Northern'),
  ('706', 'Salmabad', 'Northern'),
  ('708', 'Salmabad', 'Northern'),
  ('712', 'Salmabad', 'Northern'),
  ('1042', 'Shahrakan', 'Northern'),
  ('1044', 'Shahrakan', 'Northern'),
  ('1089', 'Um Al Naasan', 'Northern'),
  ('607', 'Abu Al Aish', 'Capital'),
  ('367', 'Abu Buham', 'Capital'),
  ('366', 'Adhari', 'Capital'),
  ('369', 'Adhari', 'Capital'),
  ('327', 'Adliya', 'Capital'),
  ('336', 'Adliya', 'Capital'),
  ('623', 'Al Akr Al Sharqi', 'Capital'),
  ('361', 'Al Belad Al Qadeem', 'Capital'),
  ('362', 'Al Belad Al Qadeem', 'Capital'),
  ('363', 'Al Belad Al Qadeem', 'Capital'),
  ('364', 'Al Belad Al Qadeem', 'Capital'),
  ('322', 'Alcornish', 'Capital'),
  ('324', 'Al Fatih', 'Capital'),
  ('342', 'Al Guraifa', 'Capital'),
  ('611', 'Al Hamriya', 'Capital'),
  ('365', 'Al Khamiss', 'Capital'),
  ('606', 'Al Kharjiya', 'Capital'),
  ('303', 'Alnaim', 'Capital'),
  ('314', 'Alnaim', 'Capital'),
  ('733', 'Al Nasfa', 'Capital'),
  ('438', 'Alqalla', 'Capital'),
  ('309', 'Alsalmaniya', 'Capital'),
  ('310', 'Alsalmaniya', 'Capital'),
  ('311', 'Alsalmaniya', 'Capital'),
  ('329', 'Alsalmaniya', 'Capital'),
  ('428', 'Alseef District', 'Capital'),
  ('436', 'Alseef District', 'Capital'),
  ('328', 'Al Suqayyah', 'Capital'),
  ('313', 'Alsuwayfia', 'Capital'),
  ('351', 'Alsuwayfia', 'Capital'),
  ('353', 'Alsuwayfia', 'Capital'),
  ('344', 'Alwajeha Albhariya', 'Capital'),
  ('346', 'Alwajeha Albhariya', 'Capital'),
  ('332', 'Bu Asheera', 'Capital'),
  ('373', 'Bu Ghasal', 'Capital'),
  ('330', 'Bu Ghazal', 'Capital'),
  ('331', 'Bu Ghazal', 'Capital'),
  ('354', 'Burhama', 'Capital'),
  ('357', 'Burhama', 'Capital'),
  ('315', 'Commercial Area', 'Capital'),
  ('316', 'Commercial Area', 'Capital'),
  ('412', 'Daih', 'Capital'),
  ('414', 'Daih', 'Capital'),
  ('317', 'Diplomatic Area', 'Capital'),
  ('307', 'Gudaibiya', 'Capital'),
  ('308', 'Gudaibiya', 'Capital'),
  ('321', 'Gudaibiya', 'Capital'),
  ('325', 'Gudaibiya', 'Capital'),
  ('326', 'Gudaibiya', 'Capital'),
  ('338', 'Gudaibiya', 'Capital'),
  ('318', 'Hoora', 'Capital'),
  ('319', 'Hoora', 'Capital'),
  ('320', 'Hoora', 'Capital'),
  ('815', 'Isa Town', 'Capital'),
  ('816', 'Isa Town', 'Capital'),
  ('721', 'Jid Ali', 'Capital'),
  ('419', 'Jidhafs', 'Capital'),
  ('421', 'Jidhafs', 'Capital'),
  ('422', 'Jidhafs', 'Capital'),
  ('423', 'Jidhafs', 'Capital'),
  ('424', 'Jidhafs', 'Capital'),
  ('425', 'Jidhafs', 'Capital'),
  ('426', 'Jidhafs', 'Capital'),
  ('340', 'Juffair', 'Capital'),
  ('341', 'Juffair', 'Capital'),
  ('729', 'Jurdab', 'Capital'),
  ('430', 'Karbabad', 'Capital'),
  ('432', 'Karbabad', 'Capital'),
  ('434', 'Karbabad', 'Capital'),
  ('633', 'Maameer', 'Capital'),
  ('634', 'Maameer', 'Capital'),
  ('602', 'Mahaza', 'Capital'),
  ('603', 'Mahaza', 'Capital'),
  ('334', 'Mahooz', 'Capital'),
  ('323', 'Manama Center', 'Capital'),
  ('343', 'Minaa Salman Industrial Area', 'Capital'),
  ('605', 'Murgoban', 'Capital'),
  ('411', 'Musala', 'Capital'),
  ('413', 'Musala', 'Capital'),
  ('380', 'Nahib Saleh', 'Capital'),
  ('381', 'Nahib Saleh', 'Capital'),
  ('382', 'Nahib Saleh', 'Capital'),
  ('592', 'Nurana', 'Capital'),
  ('644', 'Nuwaydirat', 'Capital'),
  ('604', 'Qarya', 'Capital'),
  ('312', 'Qufool', 'Capital'),
  ('306', 'Ras Ruman', 'Capital'),
  ('356', 'Salhiya', 'Capital'),
  ('402', 'Sanabis', 'Capital'),
  ('404', 'Sanabis', 'Capital'),
  ('405', 'Sanabis', 'Capital'),
  ('406', 'Sanabis', 'Capital'),
  ('408', 'Sanabis', 'Capital'),
  ('410', 'Sanabis', 'Capital'),
  ('743', 'Sanad', 'Capital'),
  ('745', 'Sanad', 'Capital'),
  ('601', 'Sitra Industrial Area', 'Capital'),
  ('301', 'Souq', 'Capital'),
  ('302', 'Souq', 'Capital'),
  ('304', 'Souq', 'Capital'),
  ('305', 'Souq', 'Capital'),
  ('368', 'Southern Sehla', 'Capital'),
  ('609', 'Sufala', 'Capital'),
  ('407', 'Tashan', 'Capital'),
  ('701', 'Tubli', 'Capital'),
  ('705', 'Tubli', 'Capital'),
  ('707', 'Tubli', 'Capital'),
  ('709', 'Tubli', 'Capital'),
  ('711', 'Tubli', 'Capital'),
  ('610', 'Um Albaidh', 'Capital'),
  ('333', 'Um Alhassam', 'Capital'),
  ('335', 'Um Alhassam', 'Capital'),
  ('337', 'Um Alhassam', 'Capital'),
  ('339', 'Um Alhassam', 'Capital'),
  ('608', 'Wadyan', 'Capital'),
  ('624', 'Western Aker', 'Capital'),
  ('625', 'Western Aker', 'Capital'),
  ('626', 'Western Aker', 'Capital'),
  ('358', 'Zinj', 'Capital'),
  ('359', 'Zinj', 'Capital'),
  ('360', 'Zinj', 'Capital'),
  ('228', 'Al Sayh', 'Muharraq'),
  ('229', 'Al Sayh', 'Muharraq'),
  ('257', 'Amwaj', 'Muharraq'),
  ('258', 'Amwaj', 'Muharraq'),
  ('263', 'Amwaj', 'Muharraq'),
  ('264', 'Amwaj', 'Muharraq'),
  ('265', 'Amwaj', 'Muharraq'),
  ('266', 'Amwaj', 'Muharraq'),
  ('269', 'Amwaj', 'Muharraq'),
  ('240', 'Arad', 'Muharraq'),
  ('241', 'Arad', 'Muharraq'),
  ('242', 'Arad', 'Muharraq'),
  ('243', 'Arad', 'Muharraq'),
  ('244', 'Arad', 'Muharraq'),
  ('245', 'Arad', 'Muharraq'),
  ('246', 'Arad', 'Muharraq'),
  ('221', 'Busaiteen', 'Muharraq'),
  ('222', 'Busaiteen', 'Muharraq'),
  ('223', 'Busaiteen', 'Muharraq'),
  ('225', 'Busaiteen', 'Muharraq'),
  ('226', 'Busaiteen', 'Muharraq'),
  ('227', 'Busaiteen', 'Muharraq'),
  ('231', 'Dair', 'Muharraq'),
  ('232', 'Dair', 'Muharraq'),
  ('233', 'Dair', 'Muharraq'),
  ('251', 'Galali', 'Muharraq'),
  ('252', 'Galali', 'Muharraq'),
  ('253', 'Galali', 'Muharraq'),
  ('254', 'Galali', 'Muharraq'),
  ('255', 'Galali', 'Muharraq'),
  ('256', 'Galali', 'Muharraq'),
  ('248', 'Halat Alnaim', 'Muharraq'),
  ('247', 'Halat Alsulta', 'Muharraq'),
  ('101', 'Hidd', 'Muharraq'),
  ('102', 'Hidd', 'Muharraq'),
  ('103', 'Hidd', 'Muharraq'),
  ('104', 'Hidd', 'Muharraq'),
  ('105', 'Hidd', 'Muharraq'),
  ('106', 'Hidd', 'Muharraq'),
  ('107', 'Hidd', 'Muharraq'),
  ('108', 'Hidd', 'Muharraq'),
  ('109', 'Hidd', 'Muharraq'),
  ('110', 'Hidd', 'Muharraq'),
  ('111', 'Hidd', 'Muharraq'),
  ('112', 'Hidd', 'Muharraq'),
  ('113', 'Hidd', 'Muharraq'),
  ('115', 'Hidd', 'Muharraq'),
  ('116', 'Hidd', 'Muharraq'),
  ('117', 'Hidd', 'Muharraq'),
  ('118', 'Hidd', 'Muharraq'),
  ('119', 'Hidd', 'Muharraq'),
  ('121', 'Hidd', 'Muharraq'),
  ('128', 'Hidd', 'Muharraq')
on conflict (block_number) do nothing;

-- 5. Row level security ----------------------------------------------------------------

alter table public.delivery_blocks enable row level security;
alter table public.delivery_drivers enable row level security;
alter table public.branch_classifications enable row level security;
alter table public.delivery_cost_settings enable row level security;
alter table public.delivery_orders enable row level security;
alter table public.delivery_order_audit_logs enable row level security;

revoke all on public.delivery_blocks from anon;
revoke all on public.delivery_drivers from anon;
revoke all on public.branch_classifications from anon;
revoke all on public.delivery_cost_settings from anon;
revoke all on public.delivery_orders from anon;
revoke all on public.delivery_order_audit_logs from anon;

grant select, insert, update, delete on public.delivery_blocks to authenticated;
grant select, insert, update, delete on public.delivery_drivers to authenticated;
grant select, insert, update, delete on public.branch_classifications to authenticated;
grant select, insert, update, delete on public.delivery_cost_settings to authenticated;
grant select, insert, update, delete on public.delivery_orders to authenticated;
grant select on public.delivery_order_audit_logs to authenticated;

grant all on public.delivery_blocks to service_role;
grant all on public.delivery_drivers to service_role;
grant all on public.branch_classifications to service_role;
grant all on public.delivery_cost_settings to service_role;
grant all on public.delivery_orders to service_role;
grant all on public.delivery_order_audit_logs to service_role;

-- Reference data: everyone authenticated can read active rows; manager manages.
drop policy if exists "delivery blocks select" on public.delivery_blocks;
create policy "delivery blocks select"
on public.delivery_blocks for select to authenticated
using (is_active or public.current_app_can_manage());

drop policy if exists "delivery blocks manage" on public.delivery_blocks;
create policy "delivery blocks manage"
on public.delivery_blocks for all to authenticated
using (public.current_app_can_manage())
with check (public.current_app_can_manage());

drop policy if exists "delivery drivers select" on public.delivery_drivers;
create policy "delivery drivers select"
on public.delivery_drivers for select to authenticated
using (is_active or public.current_app_can_manage());

drop policy if exists "delivery drivers manage" on public.delivery_drivers;
create policy "delivery drivers manage"
on public.delivery_drivers for all to authenticated
using (public.current_app_can_manage())
with check (public.current_app_can_manage());

drop policy if exists "branch classifications select" on public.branch_classifications;
create policy "branch classifications select"
on public.branch_classifications for select to authenticated
using (public.current_app_can_access_branch(branch_id));

drop policy if exists "branch classifications manage" on public.branch_classifications;
create policy "branch classifications manage"
on public.branch_classifications for all to authenticated
using (public.current_app_can_manage())
with check (public.current_app_can_manage());

-- Cost settings: manager manages; owner may read for profitability reviews.
drop policy if exists "delivery cost settings select" on public.delivery_cost_settings;
create policy "delivery cost settings select"
on public.delivery_cost_settings for select to authenticated
using (public.current_app_can_manage() or public.current_app_role() = 'owner');

drop policy if exists "delivery cost settings manage" on public.delivery_cost_settings;
create policy "delivery cost settings manage"
on public.delivery_cost_settings for all to authenticated
using (public.current_app_can_manage())
with check (public.current_app_can_manage());

-- Orders: branch users work on their own branch within a tight date window;
-- managers have full control; owner/warehouse read all; supervisors read assigned branches.
drop policy if exists "delivery orders select" on public.delivery_orders;
create policy "delivery orders select"
on public.delivery_orders for select to authenticated
using (public.current_app_can_access_branch(branch_id));

drop policy if exists "delivery orders insert" on public.delivery_orders;
create policy "delivery orders insert"
on public.delivery_orders for insert to authenticated
with check (
  public.current_app_can_manage()
  or (
    branch_id = public.current_app_branch_id()
    and order_date between (current_date - 1) and current_date
  )
);

drop policy if exists "delivery orders update" on public.delivery_orders;
create policy "delivery orders update"
on public.delivery_orders for update to authenticated
using (
  public.current_app_can_manage()
  or (branch_id = public.current_app_branch_id() and order_date = current_date)
)
with check (
  public.current_app_can_manage()
  or (
    branch_id = public.current_app_branch_id()
    and order_date between (current_date - 1) and current_date
  )
);

drop policy if exists "delivery orders delete" on public.delivery_orders;
create policy "delivery orders delete"
on public.delivery_orders for delete to authenticated
using (
  public.current_app_can_manage()
  or (branch_id = public.current_app_branch_id() and order_date = current_date)
);

-- Audit logs: managers read; rows are written by the security definer trigger only.
drop policy if exists "delivery audit select" on public.delivery_order_audit_logs;
create policy "delivery audit select"
on public.delivery_order_audit_logs for select to authenticated
using (public.current_app_can_manage());

-- 6. Post-migration checks --------------------------------------------------------------

do $$
declare
  block_count int;
  missing_gov int;
  anon_priv_count int;
  unsecured int;
begin
  select count(*) into block_count from public.delivery_blocks;
  if block_count < 450 then
    raise exception 'delivery_blocks seed incomplete: only % rows', block_count;
  end if;

  select count(*) into missing_gov from public.delivery_blocks where governorate is null;
  if missing_gov > 0 then
    raise exception '% delivery blocks missing governorate', missing_gov;
  end if;

  select count(*) into unsecured
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname in ('delivery_blocks','delivery_drivers','branch_classifications','delivery_cost_settings','delivery_orders','delivery_order_audit_logs')
    and not c.relrowsecurity;
  if unsecured > 0 then
    raise exception '% delivery tables missing RLS', unsecured;
  end if;

  select count(*) into anon_priv_count
  from information_schema.role_table_grants
  where grantee = 'anon'
    and table_schema = 'public'
    and table_name in ('delivery_blocks','delivery_drivers','branch_classifications','delivery_cost_settings','delivery_orders','delivery_order_audit_logs');
  if anon_priv_count > 0 then
    raise exception 'anon must not have privileges on delivery tables';
  end if;
end $$;

notify pgrst, 'reload schema';
