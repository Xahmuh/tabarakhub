-- Validation for BP serial gap reuse.
-- Runs inside a rollback transaction and does not persist QA data.

begin;

create temp table benefit_pay_sequence_reuse_results (
  test_name text primary key,
  expected text not null,
  actual text not null,
  passed boolean not null,
  notes text
);

do $$
declare
  v_branch_id uuid;
  v_branch_code text;
  v_test_date date := date '2099-01-01';
  v_first public.benefit_pay_transfers%rowtype;
  v_second public.benefit_pay_transfers%rowtype;
  v_reused public.benefit_pay_transfers%rowtype;
begin
  select id, code
  into v_branch_id, v_branch_code
  from public.branches
  where role = 'branch'
    and coalesce(is_active, true) = true
  order by code
  limit 1;

  if v_branch_id is null then
    insert into benefit_pay_sequence_reuse_results
    values (
      'active_branch_available',
      'active branch row exists',
      'missing',
      false,
      'Provision at least one active public.branches row with role=branch before running validation.'
    );
    return;
  end if;

  insert into public.benefit_pay_transfers (
    branch_id,
    transfer_date,
    transfer_type,
    value_bhd,
    transfer_time,
    source,
    notes
  )
  values (
    v_branch_id,
    v_test_date,
    'IBAN',
    0.001,
    time '09:00',
    'manual',
    'QA sequence reuse first'
  )
  returning * into v_first;

  insert into public.benefit_pay_transfers (
    branch_id,
    transfer_date,
    transfer_type,
    value_bhd,
    transfer_time,
    source,
    notes
  )
  values (
    v_branch_id,
    v_test_date,
    'IBAN',
    0.001,
    time '09:01',
    'manual',
    'QA sequence reuse second'
  )
  returning * into v_second;

  delete from public.benefit_pay_transfers
  where id = v_first.id;

  insert into public.benefit_pay_transfers (
    branch_id,
    transfer_date,
    transfer_type,
    value_bhd,
    transfer_time,
    source,
    notes
  )
  values (
    v_branch_id,
    v_test_date,
    'IBAN',
    0.001,
    time '09:02',
    'manual',
    'QA sequence reuse replacement'
  )
  returning * into v_reused;

  insert into benefit_pay_sequence_reuse_results
  values (
    'first_sequence',
    '1',
    v_first.sequence_no::text,
    v_first.sequence_no = 1,
    v_first.serial_number
  );

  insert into benefit_pay_sequence_reuse_results
  values (
    'second_sequence',
    '2',
    v_second.sequence_no::text,
    v_second.sequence_no = 2,
    v_second.serial_number
  );

  insert into benefit_pay_sequence_reuse_results
  values (
    'deleted_gap_reused',
    '1',
    v_reused.sequence_no::text,
    v_reused.sequence_no = 1
      and v_reused.serial_number = format(
        'BP-%s-%s-%s',
        upper(v_branch_code),
        to_char(v_test_date, 'DDMMYY'),
        '01'
      ),
    v_reused.serial_number
  );
end;
$$;

select *
from benefit_pay_sequence_reuse_results
order by test_name;

rollback;
