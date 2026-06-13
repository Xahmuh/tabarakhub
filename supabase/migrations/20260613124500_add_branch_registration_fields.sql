-- Adds branch-specific legal registration identifiers.
-- Dedicated-client model remains unchanged; these fields belong to each branch row.

alter table public.branches
  add column if not exists nhra_license_no text,
  add column if not exists cr_number text;

comment on column public.branches.nhra_license_no is 'Branch-specific NHRA license number.';
comment on column public.branches.cr_number is 'Branch-specific commercial registration number.';
