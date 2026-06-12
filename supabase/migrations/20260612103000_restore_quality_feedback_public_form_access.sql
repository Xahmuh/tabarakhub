-- Restore the minimum public access required by the Quality Feedback form.
--
-- Scope:
-- - anon can SELECT only active rows from public.quality_feedback_questions.
-- - anon cannot INSERT, UPDATE, or DELETE questions.
-- - inactive/archived/internal questions remain hidden from anon.
-- - authenticated admin/manager management remains controlled by the existing
--   public.current_app_can_manage() policies from the hardening migration.
-- - This migration does not grant access to feedback_responses, analytics
--   tables, or quality_feedback_settings.

do $$
begin
  if to_regclass('public.quality_feedback_questions') is not null then
    grant select on public.quality_feedback_questions to anon;
    revoke insert, update, delete on public.quality_feedback_questions from anon;

    drop policy if exists "Public read questions" on public.quality_feedback_questions;
    drop policy if exists "quality feedback questions select public active" on public.quality_feedback_questions;

    create policy "quality feedback questions select public active"
      on public.quality_feedback_questions
      for select
      to anon
      using (is_active = true);
  end if;
end $$;
