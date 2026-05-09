# Database Migrations

All SQL migration files are located in the project root for backward compatibility.
See root-level `*_migration.sql` and `*.sql` files.

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
