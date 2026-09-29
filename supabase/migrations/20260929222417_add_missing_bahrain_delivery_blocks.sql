-- Keep the order-entry block directory aligned with the Bahrain block geometry.
-- Area assignments were derived by spatially joining the ten missing block
-- polygons to the repository's official area polygons.

insert into public.delivery_areas (name, governorate)
select source.name, source.governorate
from (
  values
    ('Diyar Al Muharraq', 'Muharraq'),
    ('Tubli', 'Capital'),
    ('Al Ramli', 'Northern'),
    ('Madinat Khalifa / Mishref', 'Southern'),
    ('Madinat Khalifa / Umm Alowsaj', 'Southern'),
    ('Ras Hayan', 'Southern'),
    ('Madinat Khalifa / Alulaim', 'Southern'),
    ('Madinat Khalifa / Almahadir', 'Southern'),
    ('Zallaq', 'Southern')
) as source(name, governorate)
where not exists (
  select 1
  from public.delivery_areas existing
  where lower(existing.name) = lower(source.name)
    and existing.governorate = source.governorate
    and existing.is_active
);

with missing_blocks(block_number, area_name, governorate) as (
  values
    ('262', 'Diyar Al Muharraq', 'Muharraq'),
    ('713', 'Tubli', 'Capital'),
    ('716', 'Al Ramli', 'Northern'),
    ('956', 'Madinat Khalifa / Mishref', 'Southern'),
    ('962', 'Madinat Khalifa / Umm Alowsaj', 'Southern'),
    ('963', 'Ras Hayan', 'Southern'),
    ('964', 'Madinat Khalifa / Alulaim', 'Southern'),
    ('966', 'Madinat Khalifa / Almahadir', 'Southern'),
    ('1057', 'Zallaq', 'Southern'),
    ('1058', 'Zallaq', 'Southern')
)
insert into public.delivery_blocks (
  block_number,
  area_id,
  area_name,
  governorate,
  is_active,
  updated_at
)
select
  source.block_number,
  area.id,
  source.area_name,
  source.governorate,
  true,
  now()
from missing_blocks source
join public.delivery_areas area
  on lower(area.name) = lower(source.area_name)
 and area.governorate = source.governorate
 and area.is_active
on conflict (block_number) do update
set area_id = excluded.area_id,
    area_name = excluded.area_name,
    governorate = excluded.governorate,
    is_active = true,
    updated_at = now();

do $$
declare
  active_block_count integer;
begin
  select count(*)
  into active_block_count
  from public.delivery_blocks
  where is_active
    and area_id is not null
    and block_number = any (array[
      '262', '713', '716', '956', '962',
      '963', '964', '966', '1057', '1058'
    ]);

  if active_block_count <> 10 then
    raise exception 'Missing Bahrain delivery block sync failed: expected 10 active rows, found %', active_block_count;
  end if;
end
$$;
