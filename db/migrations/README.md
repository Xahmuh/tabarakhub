# Database Migrations

Legacy SQL migration files are kept here for backward compatibility.
Production Supabase migrations live in `supabase/migrations`.

Apply `supabase/migrations/20260612034500_security_auth_rls_hardening.sql`
after the legacy schema to remove broad anonymous policies and enable
Supabase Auth/profile-backed RLS.

## Files Reference

| Root File | Migration |
|-----------|-----------|
| `supabase_migration.sql` | Initial schema |
| `settings_migration.sql` | Settings tables |
| `cash_flow_migration.sql` | Cash flow planner |
| `cash_flow_time_migration.sql` | Cash flow time updates |
| `cash_difference_migration.sql` | Cash difference tracking |
| `codex_migration.sql` | Corporate codex |
| `hr_requests_migration.sql` | HR requests |
| `fix_pharmacists_db.sql` | Pharmacist fixes |
| `fix_branches_rls.sql` | Branch RLS fixes |
| `add_agent_to_shortages.sql` | Agent field addition |
