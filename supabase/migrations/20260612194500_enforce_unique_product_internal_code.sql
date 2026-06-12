-- Prevent duplicate catalog products for the same item code.
-- Bulk upload uses products.internal_code as the upsert key.

do $$
declare
  duplicate_codes text;
begin
  if to_regclass('public.products') is null then
    return;
  end if;

  update public.products
  set internal_code = nullif(upper(btrim(internal_code)), '')
  where internal_code is not null
    and internal_code is distinct from nullif(upper(btrim(internal_code)), '');

  select string_agg(code || ' (' || row_count || ' rows)', ', ' order by code)
  into duplicate_codes
  from (
    select internal_code as code, count(*) as row_count
    from public.products
    where internal_code is not null
    group by internal_code
    having count(*) > 1
  ) duplicates;

  if duplicate_codes is not null then
    raise notice
      'Clearing duplicate products.internal_code values before enforcing uniqueness: %',
      duplicate_codes;

    with ranked_products as (
      select
        id,
        row_number() over (
          partition by internal_code
          order by
            (international_code is not null) desc,
            (default_price is not null) desc,
            id
        ) as duplicate_rank
      from public.products
      where internal_code is not null
    )
    update public.products p
    set internal_code = null
    from ranked_products rp
    where p.id = rp.id
      and rp.duplicate_rank > 1;
  end if;

  select string_agg(code || ' (' || row_count || ' rows)', ', ' order by code)
  into duplicate_codes
  from (
    select internal_code as code, count(*) as row_count
    from public.products
    where internal_code is not null
    group by internal_code
    having count(*) > 1
  ) duplicates;

  if duplicate_codes is not null then
    raise exception
      'Cannot enforce unique products.internal_code after duplicate cleanup: %',
      duplicate_codes;
  end if;

  execute 'create unique index if not exists products_internal_code_unique_idx on public.products (internal_code)';
end $$;

notify pgrst, 'reload schema';
