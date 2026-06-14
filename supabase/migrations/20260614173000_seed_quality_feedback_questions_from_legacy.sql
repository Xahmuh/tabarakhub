-- Seed current Quality Feedback questions from the legacy question table.
-- This migration is intentionally non-destructive:
-- - it does not delete/drop/truncate feedback_questions;
-- - it only upserts into quality_feedback_questions by field_key;
-- - it hardens legacy/old question policies so anon cannot write questions.

do $$
begin
  if to_regclass('public.quality_feedback_questions') is null then
    raise exception 'public.quality_feedback_questions does not exist';
  end if;

  if to_regclass('public.feedback_questions') is null then
    raise exception 'public.feedback_questions does not exist';
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.quality_feedback_questions'::regclass
      and conname = 'qf_questions_field_key_unique'
  ) then
    alter table public.quality_feedback_questions
      add constraint qf_questions_field_key_unique unique (field_key);
  end if;
end $$;

insert into public.quality_feedback_questions (
  section,
  text_en,
  text_ar,
  field_key,
  order_index,
  is_active,
  created_at
)
select
  section,
  text_en,
  text_ar,
  field_key,
  coalesce(order_index, 0),
  coalesce(is_active, true),
  coalesce(created_at, now())
from public.feedback_questions
on conflict on constraint qf_questions_field_key_unique do update
set
  section = excluded.section,
  text_en = excluded.text_en,
  text_ar = excluded.text_ar,
  order_index = excluded.order_index,
  is_active = excluded.is_active;

alter table public.quality_feedback_questions enable row level security;
alter table public.feedback_questions enable row level security;

revoke all on public.quality_feedback_questions from anon, authenticated;
grant select on public.quality_feedback_questions to anon, authenticated;
grant insert, update, delete on public.quality_feedback_questions to authenticated;
grant all on public.quality_feedback_questions to service_role;

drop policy if exists "Allow question deletes" on public.quality_feedback_questions;
drop policy if exists "Allow question inserts" on public.quality_feedback_questions;
drop policy if exists "Allow question updates" on public.quality_feedback_questions;
drop policy if exists "Read all questions" on public.quality_feedback_questions;
drop policy if exists "Public read questions" on public.quality_feedback_questions;
drop policy if exists "quality feedback questions select public active" on public.quality_feedback_questions;
drop policy if exists "quality feedback questions select authenticated" on public.quality_feedback_questions;
drop policy if exists "quality feedback questions manage authenticated" on public.quality_feedback_questions;

create policy "quality feedback questions select public active"
on public.quality_feedback_questions
for select
to anon
using (is_active = true);

create policy "quality feedback questions select authenticated"
on public.quality_feedback_questions
for select
to authenticated
using (is_active = true or coalesce(public.current_app_role() in ('manager', 'owner'), false));

create policy "quality feedback questions manage managers"
on public.quality_feedback_questions
for all
to authenticated
using (coalesce(public.current_app_role() in ('manager', 'owner'), false))
with check (coalesce(public.current_app_role() in ('manager', 'owner'), false));

-- The legacy table is no longer read by the app. Keep it as a locked backup
-- until the migration is applied and browser QA confirms the new table works.
revoke all on public.feedback_questions from anon, authenticated;
grant all on public.feedback_questions to service_role;

drop policy if exists "Admins can manage questions" on public.feedback_questions;
drop policy if exists "Allow question deletes" on public.feedback_questions;
drop policy if exists "Allow question inserts" on public.feedback_questions;
drop policy if exists "Allow question updates" on public.feedback_questions;
drop policy if exists "Anyone can read active questions" on public.feedback_questions;
drop policy if exists "Read all questions" on public.feedback_questions;
drop policy if exists "feedback questions service role only" on public.feedback_questions;

create policy "feedback questions service role only"
on public.feedback_questions
for all
to service_role
using (true)
with check (true);

notify pgrst, 'reload schema';
