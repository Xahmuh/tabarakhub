# Access Control Zones and Branch Staff

Status:

```text
B) dedicated-client staging-ready only
```

## Source of Truth

Access Control owns branch access grouping and branch staff assignment.

- Zones are independent from Delivery Areas.
- Delivery Areas remain delivery geography/reference data only.
- Delivery consumes branch-scoped assignments for recording, templates, and validation.
- Delivery Settings must not define supervisor zones.

## Schema Model

- `branch_zones`: Access-owned zone code/name, active state, notes, and one supervisor login.
- `branch_zone_members`: zone-to-branch membership. A branch can belong to only one active zone assignment path.
- `supervisor_branches`: derived compatibility table for existing RLS policies and branch-scope checks.
- `pharmacist_branches`: existing pharmacist-to-branch assignment table.
- `delivery_driver_branches`: new driver-to-branch assignment table.

## UI Model

Access Control now has:

- `Zones`: create/edit zone code, zone name, active state, notes, branches, and supervisor.
- `Branch Staff`: choose a branch, then multi-select pharmacists and drivers.

Delivery Recording and dispatch now read:

- pharmacists from `pharmacist_branches` for the current branch.
- drivers from `delivery_driver_branches` for the current branch.

## RLS / Security

- `anon` receives no table grants.
- `anon` receives no execute grants on the Access-first supervisor zone RPCs.
- Admin/manager roles can manage zones and branch staff assignments.
- Owner remains read-only through existing read-all role helpers where applicable.
- Branch and supervisor reads are scoped through `current_app_can_access_branch(branch_id)`.
- Driver self-read is allowed on `delivery_driver_branches` for the current driver profile.
- Writes use existing manager-only helpers; no service-role key is exposed in client code.

## Migration Status

Applied migrations:

```text
supabase/migrations/20260617233656_access_supervisor_zones.sql
supabase/migrations/20260618013407_revoke_access_zone_rpc_anon.sql
supabase/migrations/20260618013956_revoke_access_zone_trigger_helper_authenticated.sql
```

The linked Supabase project is aligned through `20260618013956`.

The migration backs up wrong `delivery_areas` supervisor fields before removing the wrong access ownership model from `delivery_areas`.

The migration source does not auto-create generated supervisor zones from legacy rows. Admins create zones, assign branch members, and assign supervisors in Access Control. `supervisor_branches` is maintained as a derived compatibility table after zones are managed there.

## Post-Apply Validation

Applied database checks passed for:

- `branch_zones`, `branch_zone_members`, `delivery_driver_branches`, and `access_model_cleanup_backups` existence
- no `delivery_areas.supervisor_id`
- no `delivery_areas.supervisor_user_id`
- backed-up `delivery_areas` supervisor data count only, without printing payloads
- no orphan `branch_zone_members`
- no orphan `pharmacist_branches`
- no orphan `delivery_driver_branches`
- no duplicate staff assignments
- `supervisor_branches` derived sync parity for configured Access Control zones
- RLS enabled and no `anon` table/RPC grants
- trigger helper not exposed as an authenticated RPC endpoint

## Pending Approval

- Browser QA for Access Control Zones.
- Browser QA for Branch Staff assignment.
- Delivery Recording QA for branch-scoped pharmacist and driver dropdowns.
- Dispatch QA for branch-scoped driver picker.
- No manual deployment has been performed.
