-- Product catalog prices are stored excluding VAT.
-- Managers assign whether Bahrain VAT applies per product.

do $$
begin
  if to_regclass('public.products') is null then
    return;
  end if;

  alter table public.products
    add column if not exists vat_enabled boolean not null default false,
    add column if not exists vat_rate numeric(5,4) not null default 0.1000;

  update public.products
  set vat_enabled = coalesce(vat_enabled, false),
      vat_rate = coalesce(vat_rate, 0.1000);

  alter table public.products
    alter column vat_enabled set default false,
    alter column vat_enabled set not null,
    alter column vat_rate set default 0.1000,
    alter column vat_rate set not null;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'products_vat_rate_range_check'
      and conrelid = 'public.products'::regclass
  ) then
    alter table public.products
      add constraint products_vat_rate_range_check
      check (vat_rate >= 0 and vat_rate <= 1);
  end if;
end $$;

notify pgrst, 'reload schema';
