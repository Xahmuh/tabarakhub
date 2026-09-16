-- Seed realistic compliance data (Passport Number, PP Expiry Date, WP Expiry Date)
-- for existing workforce personnel where fields are currently null.

-- 1. Delivery Drivers
update public.delivery_drivers
set
  passport_number = coalesce(passport_number, 'B' || lpad((abs(hashtext(id::text)) % 90000000 + 10000000)::text, 8, '0')),
  pp_expiry_date = coalesce(pp_expiry_date, (current_date + ((abs(hashtext(id::text)) % 650 + 25) || ' days')::interval)::date),
  wp_expiry_date = coalesce(wp_expiry_date, (current_date + ((abs(hashtext(id::text || 'wp')) % 450 + 20) || ' days')::interval)::date)
where passport_number is null or pp_expiry_date is null or wp_expiry_date is null;

-- 2. Clinical Pharmacists
update public.pharmacists
set
  passport_number = coalesce(passport_number, 'E' || lpad((abs(hashtext(id::text)) % 90000000 + 10000000)::text, 8, '0')),
  pp_expiry_date = coalesce(pp_expiry_date, (current_date + ((abs(hashtext(id::text)) % 700 + 30) || ' days')::interval)::date),
  wp_expiry_date = coalesce(wp_expiry_date, (current_date + ((abs(hashtext(id::text || 'wp')) % 500 + 25) || ' days')::interval)::date)
where passport_number is null or pp_expiry_date is null or wp_expiry_date is null;

-- 3. App User Profiles (Staff / Workers / Management)
update public.app_user_profiles
set
  passport_number = coalesce(passport_number, 'W' || lpad((abs(hashtext(user_id::text)) % 90000000 + 10000000)::text, 8, '0')),
  pp_expiry_date = coalesce(pp_expiry_date, (current_date + ((abs(hashtext(user_id::text)) % 600 + 30) || ' days')::interval)::date),
  wp_expiry_date = coalesce(wp_expiry_date, (current_date + ((abs(hashtext(user_id::text || 'wp')) % 400 + 30) || ' days')::interval)::date)
where passport_number is null or pp_expiry_date is null or wp_expiry_date is null;
