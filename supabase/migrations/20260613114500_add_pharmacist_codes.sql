-- Add a stable operational code for every pharmacist/person profile.
-- Existing rows receive P001, P002, ... codes so the column can be enforced.

do $$
begin
  if to_regclass('public.pharmacists') is null then
    return;
  end if;

  alter table public.pharmacists
    add column if not exists code text;

  update public.pharmacists
  set code = nullif(regexp_replace(upper(btrim(coalesce(code, ''))), '[^A-Z0-9_-]', '', 'g'), '')
  where code is distinct from nullif(regexp_replace(upper(btrim(coalesce(code, ''))), '[^A-Z0-9_-]', '', 'g'), '');

  with missing_codes as (
    select
      id,
      row_number() over (order by coalesce(name, ''), id) as code_number
    from public.pharmacists
    where nullif(btrim(coalesce(code, '')), '') is null
  )
  update public.pharmacists p
  set code = 'P' || lpad(m.code_number::text, 3, '0')
  from missing_codes m
  where p.id = m.id;

  with duplicate_codes as (
    select
      id,
      code,
      row_number() over (partition by upper(btrim(code)) order by coalesce(name, ''), id) as duplicate_number
    from public.pharmacists
    where nullif(btrim(code), '') is not null
  )
  update public.pharmacists p
  set code = left(d.code, 25) || '-' || upper(substr(replace(p.id::text, '-', ''), 1, 6))
  from duplicate_codes d
  where p.id = d.id
    and d.duplicate_number > 1;

  alter table public.pharmacists
    alter column code set not null;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'pharmacists_code_format_chk'
      and conrelid = 'public.pharmacists'::regclass
  ) then
    alter table public.pharmacists
      add constraint pharmacists_code_format_chk
      check (code ~ '^[A-Z0-9_-]{1,32}$');
  end if;

  create unique index if not exists pharmacists_code_unique_idx
    on public.pharmacists (upper(btrim(code)));
end $$;
