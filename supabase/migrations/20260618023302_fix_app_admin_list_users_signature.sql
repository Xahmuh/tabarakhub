-- Safe: drops only the function definition, no table or data is affected.
-- Required because Postgres cannot change return type via CREATE OR REPLACE.
DROP FUNCTION IF EXISTS public.app_admin_list_users();
