-- Drop the legacy shortages Excel export view after runtime export paths moved
-- to public.export_shortages_paginated. No CASCADE: hidden dependencies must
-- fail the migration instead of being removed implicitly.

drop view if exists public.shortages_excel_export;
