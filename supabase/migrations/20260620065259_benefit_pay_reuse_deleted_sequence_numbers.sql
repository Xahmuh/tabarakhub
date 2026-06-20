-- Reuse deleted Benefit Pay serial numbers per branch/day.
-- Example: if BP-T001-200626-01 is deleted, the next insert for T001 on
-- 2026-06-20 receives sequence 01 again instead of skipping to the next value.

create or replace function public.benefit_pay_next_sequence(
  p_branch_id uuid,
  p_transfer_date date
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_last_sequence integer;
  v_next_sequence integer;
  v_search_ceiling integer;
begin
  if p_branch_id is null then
    raise exception 'Branch is required for Benefit Pay serial generation'
      using errcode = '23502';
  end if;

  if p_transfer_date is null then
    raise exception 'Transfer date is required for Benefit Pay serial generation'
      using errcode = '23502';
  end if;

  insert into public.benefit_pay_daily_sequences(branch_id, transfer_date, last_sequence)
  values (p_branch_id, p_transfer_date, 0)
  on conflict (branch_id, transfer_date) do nothing;

  select last_sequence
  into v_last_sequence
  from public.benefit_pay_daily_sequences
  where branch_id = p_branch_id
    and transfer_date = p_transfer_date
  for update;

  v_search_ceiling := greatest(coalesce(v_last_sequence, 0) + 1, 1);

  select candidate.sequence_no
  into v_next_sequence
  from generate_series(1, v_search_ceiling) as candidate(sequence_no)
  where not exists (
    select 1
    from public.benefit_pay_transfers transfer
    where transfer.branch_id = p_branch_id
      and transfer.transfer_date = p_transfer_date
      and transfer.sequence_no = candidate.sequence_no
  )
  order by candidate.sequence_no
  limit 1;

  if v_next_sequence is null then
    v_next_sequence := v_search_ceiling;
  end if;

  update public.benefit_pay_daily_sequences
  set
    last_sequence = greatest(last_sequence, v_next_sequence),
    updated_at = now()
  where branch_id = p_branch_id
    and transfer_date = p_transfer_date;

  return v_next_sequence;
end;
$$;

revoke all on function public.benefit_pay_next_sequence(uuid, date) from public, anon, authenticated;
grant execute on function public.benefit_pay_next_sequence(uuid, date) to service_role;

notify pgrst, 'reload schema';
