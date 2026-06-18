create or replace function public.execute_spin_transaction(
  p_token text,
  p_phone text,
  p_first_name text default null::text,
  p_last_name text default null::text,
  p_email text default null::text
)
returns table (
  spin_id uuid,
  voucher_code text,
  prize_id uuid,
  prize_name text,
  prize_type text,
  prize_value numeric
)
language plpgsql
security definer
set search_path = public
as $$
DECLARE
    v_branch_id UUID;
    v_customer_id UUID;
    v_prize_id UUID;
    v_prize_record public.spin_prizes%ROWTYPE;
    v_voucher_code TEXT;
    v_session_used BOOLEAN;
    v_multi_use BOOLEAN;
    v_random_suffix TEXT;
BEGIN
    -- [Standard Validation Logic Omitted for Brevity] --
    
    -- 1. Upsert Customer & Select Prize (As before)

    -- 2. GENERATE CODE WITH STRICT PREFIX
    v_random_suffix := upper(substring(md5(random()::text), 1, 8));
    v_voucher_code := 'VOUCH-' || v_random_suffix;
    
    -- Safety check loop
    WHILE EXISTS (SELECT 1 FROM public.spins s WHERE s.voucher_code = v_voucher_code) LOOP
        v_random_suffix := upper(substring(md5(random()::text), 1, 8));
        v_voucher_code := 'VOUCH-' || v_random_suffix;
    END LOOP;

    -- 3. Record Spin & Return
    INSERT INTO public.spins (customer_id, branch_id, prize_id, voucher_code)
    VALUES (v_customer_id, v_branch_id, v_prize_id, v_voucher_code)
    RETURNING id INTO spin_id;
    
    -- [Cleanup Logic Omitted] --

    RETURN QUERY SELECT 
        spin_id, 
        v_voucher_code, 
        v_prize_id, 
        v_prize_record.name::TEXT, 
        v_prize_record.type::TEXT, 
        v_prize_record.value;
END;
$$;
