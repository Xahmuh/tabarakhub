# Project Clean Data Layer Audit

Status:

```text
B) dedicated-client staging-ready only
```

Date: 2026-06-17

## Phase B Apply And Validation Update

Status:

```text
B) dedicated-client staging-ready only
```

Migration applied to the linked Supabase project:

```text
20260617151416_create_phase_b_clean_views.sql
```

Remote migration history is aligned through `20260617151416`.

Validated views:

| View | Validation result |
|---|---|
| `delivery_orders_clean` | Created, 46 rows visible to admin/owner role simulation. |
| `delivery_drivers_clean` | Created, 41 rows visible to admin/owner role simulation. |
| `branches_clean` | Created, 22 operational branch rows visible to admin/owner role simulation. |

RLS and grants:

- `anon` direct read attempt failed with `42501 permission denied`.
- `authenticated` has `select` only on the three views.
- `authenticated` has no `insert`, `update`, or `delete` privileges on the views.
- Direct authenticated write attempt against `delivery_drivers_clean` failed with `42501 permission denied`.
- T001 branch simulation saw only branch code `T001` and zero cross-branch delivery rows.
- Owner and admin simulations saw 46 orders, 41 drivers, and 22 branches.

Shape checks:

- `delivery_orders_clean` has 44 `actual_delivery` rows and 2 `internal_transfer` rows.
- Both internal-transfer rows intentionally have null block/area/governorate fields.
- Driver display fields come from `delivery_drivers`; mismatch check returned zero rows.
- Hidden legacy/sensitive fields remain absent from the clean view column lists.

No destructive cleanup was performed. Raw tables remain the source of truth. Phase C/D remain pending.

## Phase B Implementation Update

Status:

```text
B) dedicated-client staging-ready only
```

Phase B has been prepared as a local migration only:

```text
supabase/migrations/20260617151416_create_phase_b_clean_views.sql
```

Prepared views:

- `public.delivery_orders_clean`
- `public.delivery_drivers_clean`
- `public.branches_clean`

The migration has not been applied remotely. No columns were dropped, no data was deleted, no production data was rewritten, and no raw table was replaced.

Security posture:

- every Phase B view uses `security_invoker = true`;
- `anon` receives no grant;
- `authenticated` receives `select` only;
- no write grants are created;
- raw table RLS remains the authority;
- `branches_clean` also calls `current_app_can_access_branch(id)` because the raw `branches` table still has legacy broad read policies.

Fields intentionally hidden:

- `delivery_orders`: `order_value`, `payment_method`, `order_type`, `business_date`, `transfer_time`, `is_posted`, `deleted_at`, raw legacy `driver_name`, `created_by_branch_id`, `updated_by_branch_id`, `created_by`, `updated_by`;
- `delivery_drivers`: `phone`, `notes`, `auth_user_id`, `expo_push_token`, `updated_by`;
- `branches`: `whatsapp_number`, `nhra_license_no`, `cr_number`, `branch_manager_name`, delivery profile notes, and any credential/backup data.

## Executive Summary

Create a clean data layer, but do it in phases.

Raw tables remain the source of truth for app writes, RLS, audit history, and legacy compatibility. Clean views should be read-only operational/reporting shapes that hide legacy, duplicate, technical, and sensitive fields.

Recommended first implementation after approval:

1. `delivery_orders_clean`
2. `delivery_drivers_clean`
3. `branches_clean`

No migration was created or applied in this audit pass. Phase A is documentation only.

## Sources Inspected

- Linked Supabase catalog via `supabase db query --linked`.
- Linked Supabase migration history via `supabase migration list --linked`.
- Supabase docs/changelog for current view and Data API behavior.
- `supabase/migrations/`
- `supabase/functions/`
- `services/`
- `app/`
- `apps/driver-mobile/src/`
- `lib/`
- `types.ts`
- `docs/`

Current linked database:

| Item | Value |
|---|---|
| Postgres version | `17.6` |
| `security_invoker` view support | yes |
| Clean-view migration applied | no |
| Remote schema changes made | no |

## Design Rule

```text
Raw tables = app writes and database source of truth
Clean views = read-only operational/reporting/admin-friendly data
```

All clean views should use:

```sql
create view public.<name> with (security_invoker = true) as ...
```

Then:

```sql
revoke all on public.<name> from anon, authenticated;
grant select on public.<name> to authenticated;
```

Do not grant write privileges on clean views. Do not grant `anon` access to internal operational views.

## Candidate Table Matrix

| Table | Current purpose | Problem | Needs clean view? | Reason | Risk level |
|---|---|---|---|---|---|
| `delivery_orders` | Delivery recording, lifecycle, driver assignment, internal transfers | Legacy and new columns coexist; repeated joins to branches, drivers, pharmacists, payment types | yes | High-value admin/reporting table; Phase B starter | medium |
| `delivery_drivers` | Driver master, app identity link, online state, push token | Operational fields mixed with auth/user/device fields | yes | Admin/reporting needs driver code/name/status without auth or push fields | medium |
| `branches` | Branch directory, feature flags, delivery origin, contact/regulatory info | Business directory mixed with flags/contact/regulatory fields | yes | Most screens need branch code/name and delivery state | medium |
| `branch_delivery_profiles` | Delivery origin block, delivery radii, target minutes | Requires join to branches to understand | merge into `branches_clean` | Useful as branch delivery columns, not a standalone first view | low |
| `delivery_payment_types` | Delivery payment configuration | Already small and clean | no | Use as join source for labels and `requires_block` | low |
| `app_user_profiles` | Root app authorization profile | Auth scope table; email lives in `auth.users`; writes are service-role controlled | not as public DB view | Use existing admin RPC/DTO or a private-schema view; do not expose auth internals | high |
| `supervisor_branches` | Supervisor-to-branch assignment | Pure join table | no standalone view | Use only inside admin/user DTOs | medium |
| `operations_tasks` | Command Center task queue | Free-text operational fields; branch/user joins required | yes, Phase C | Good reporting candidate after role review | medium |
| `operations_task_events` | Task event history | Event detail table; free-text comments | no standalone view | Use in task detail/admin exports only | medium |
| `quality_feedback_questions` | Current feedback question configuration | Already clean config; public active read exists | no | Existing table is understandable; no need for clean view | low |
| `quality_feedback_settings` | Current feedback module settings | Small config table | no | Existing table is understandable | low |
| `feedback_responses` | Quality feedback submissions | Free-text comments and ratings; current policy exposes too broadly | yes, after RLS fix | Use anonymized/admin-safe `quality_feedback_clean` only after security hardening | high |
| `cash_differences` | Branch cash reconciliation | Finance data plus comments/invoice references | yes, Phase C | Useful reporting table, but finance-sensitive | high |
| `lost_sales` | Lost-sales operational log | Large table; duplicated product/pharmacist snapshots; reporting needs branch/product enrichment | yes, Phase C | High reporting value | medium |
| `shortages` | Shortage operational log | Large table; JSON history and duplicated snapshots | yes, Phase C | High reporting value | medium |
| `spin_prizes` | Prize config | Public-facing config | no | Already simple; include only as join source if needed | low |
| `spin_sessions` | Spin token/session state | Contains redeemable tokens | no | Sensitive, never expose in clean reporting views | critical |
| `spins` | Voucher issuance and redemption | Voucher codes, customer links, IP address | aggregate only | Raw rows contain sensitive voucher/customer/fraud fields | high |
| `customers` | Spin customer contact data | Phone, email, names | no | PII; do not expose in clean views | critical |
| `branch_reviews` | Review click tracking | Customer linkage | aggregate only | Avoid customer-level exposure | high |
| `voucher_shares` | Voucher share tracking | Voucher code and customer linkage | no | Sensitive voucher/customer linkage | high |

## Legacy And Hidden Columns

| Table | Column | Current usage | Legacy/duplicate? | Replacement | Recommendation |
|---|---|---|---|---|---|
| `delivery_orders` | `order_value` | Legacy delivery value | yes | `value_bhd` | `deprecated_keep_for_now` |
| `delivery_orders` | `payment_method` | Legacy payment enum | yes | `payment_type` | `deprecated_keep_for_now` |
| `delivery_orders` | `order_type` | Legacy order type | yes | `order_kind` | `deprecated_keep_for_now` |
| `delivery_orders` | `business_date` | Legacy business date | yes | `order_date` | `deprecated_keep_for_now` |
| `delivery_orders` | `driver_name` | Legacy driver name snapshot | yes | join `delivery_drivers.name` | `hide_from_clean_view` |
| `delivery_orders` | `transfer_time` | Older transfer/time field | likely | lifecycle timestamps | `hide_from_clean_view` |
| `delivery_orders` | `is_posted` | Older posting flag | likely | lifecycle/status reporting | `hide_from_clean_view` |
| `delivery_orders` | `deleted_at` | Soft-delete marker | technical | clean filters should normally exclude deleted rows | `hide_from_clean_view` |
| `delivery_orders` | `created_by_branch_id` | Older branch actor trace | duplicate | `created_by` plus profile/branch joins | `hide_from_clean_view` |
| `delivery_orders` | `updated_by_branch_id` | Older branch actor trace | duplicate | `updated_by` plus profile/branch joins | `hide_from_clean_view` |
| `delivery_orders` | `pharmacist_name` | Snapshot fallback | duplicate but useful | join pharmacist name when available | `keep` |
| `delivery_drivers` | `phone` | Driver contact | sensitive | admin-only contact view if needed | `hide_from_clean_view` |
| `delivery_drivers` | `auth_user_id` | Auth identity link | sensitive | internal admin RPC only | `sensitive_never_expose` |
| `delivery_drivers` | `expo_push_token` | Push token | sensitive | none | `sensitive_never_expose` |
| `delivery_drivers` | `updated_by` | Audit actor | technical | admin audit view if needed | `hide_from_clean_view` |
| `delivery_drivers` | `notes` | Free text | potentially sensitive | admin-only detail view | `hide_from_clean_view` |
| `branches` | `google_maps_link` | Customer-facing location link | operational but external | include only if needed | `keep` |
| `branches` | `whatsapp_number` | Branch contact | sensitive-ish | separate internal contact view | `hide_from_clean_view` |
| `branches` | `nhra_license_no` | Regulatory ID | sensitive-ish | compliance/admin-only view | `hide_from_clean_view` |
| `branches` | `cr_number` | Regulatory/commercial ID | sensitive-ish | compliance/admin-only view | `hide_from_clean_view` |
| `branches` | `branch_manager_name` | Person name | sensitive-ish | admin-only view | `hide_from_clean_view` |
| `branch_delivery_profiles` | `notes` | Free text | potentially sensitive | none | `hide_from_clean_view` |
| `branch_delivery_profiles` | `created_by` | Audit actor | technical | audit view | `hide_from_clean_view` |
| `branch_delivery_profiles` | `updated_by` | Audit actor | technical | audit view | `hide_from_clean_view` |
| `app_user_profiles` | `user_id` | Auth user id | sensitive but required for admin | existing admin RPC | `keep_in_admin_dto_only` |
| `app_user_profiles` | `branch_id` | Role scope | no | branch code/name join | `keep` |
| `operations_tasks` | `description` | Free text | sensitive possible | admin/reporting only | `keep_with_role_scope` |
| `operations_tasks` | `recommended_action` | Free text | sensitive possible | admin/reporting only | `keep_with_role_scope` |
| `operations_tasks` | `next_step` | Free text | sensitive possible | admin/reporting only | `keep_with_role_scope` |
| `operations_tasks` | `related_record_id` | Technical link | no | display with type | `keep` |
| `operations_task_events` | `comment` | Free text | sensitive possible | task detail/admin only | `hide_from_general_view` |
| `feedback_responses` | `ops_1`..`it_3` | Legacy fixed score columns | duplicate with `ratings`/derived scores | `ratings`, `overall_score` | `deprecated_keep_for_now` |
| `feedback_responses` | `biggest_issue` | Free text | sensitive possible | admin-only raw detail | `hide_from_general_view` |
| `feedback_responses` | `best_thing` | Free text | sensitive possible | admin-only raw detail | `hide_from_general_view` |
| `feedback_responses` | `improvement_suggestion` | Free text | sensitive possible | admin-only raw detail | `hide_from_general_view` |
| `feedback_responses` | `key_topics` | AI/analysis metadata | technical | aggregate/reporting | `keep_with_role_scope` |
| `cash_differences` | `branch_name` | Snapshot branch name | duplicate | join `branches.name` | `hide_from_clean_view` |
| `cash_differences` | `invoice_reference` | Finance reference | sensitive | finance/admin-only view | `hide_from_general_view` |
| `cash_differences` | `reason` | Free text | sensitive possible | finance/admin-only view | `hide_from_general_view` |
| `cash_differences` | `manager_comment` | Free text | sensitive possible | finance/admin-only view | `hide_from_general_view` |
| `lost_sales` | `product_name` | Product snapshot | duplicate but needed for history | join product when available | `keep` |
| `lost_sales` | `pharmacist_name` | Snapshot | duplicate but needed for history | join pharmacist when available | `keep` |
| `lost_sales` | `agent_name` | Product snapshot | duplicate | join product/agent when available | `keep` |
| `lost_sales` | `price_source` | Technical/manual marker | no | simple label if needed | `hide_from_general_view` |
| `lost_sales` | `is_manual` | Technical/manual marker | no | simple label if needed | `hide_from_general_view` |
| `lost_sales` | `notes` | Free text | sensitive possible | admin-only detail | `hide_from_general_view` |
| `shortages` | `history` | JSON status history | technical | latest status plus separate detail if needed | `hide_from_clean_view` |
| `shortages` | `pharmacist_name` | Snapshot | duplicate but needed for history | join pharmacist when available | `keep` |
| `shortages` | `agent_name` | Product snapshot | duplicate | join product/agent when available | `keep` |
| `shortages` | `notes` | Free text | sensitive possible | admin-only detail | `hide_from_general_view` |
| `spin_sessions` | `token` | Redeemable token | sensitive | none | `sensitive_never_expose` |
| `spins` | `voucher_code` | Redeemable/trackable voucher | sensitive | masked code only if needed | `sensitive_never_expose_general` |
| `spins` | `ip_address` | Fraud/PII signal | sensitive | aggregate only | `sensitive_never_expose` |
| `spins` | `customer_id` | PII link | sensitive | aggregate only | `sensitive_never_expose_general` |
| `customers` | `phone` | PII | sensitive | none in clean views | `sensitive_never_expose` |
| `customers` | `email` | PII | sensitive | none in clean views | `sensitive_never_expose` |
| `customers` | `first_name`, `last_name` | PII | sensitive | none in clean views | `sensitive_never_expose_general` |

## Proposed Views

| View | Source tables | Purpose | RLS strategy |
|---|---|---|---|
| `delivery_orders_clean` | `delivery_orders`, `branches`, `delivery_drivers`, `pharmacists`, `delivery_payment_types` | Business-friendly order/lifecycle reporting | `security_invoker=true`, `authenticated` select only, no anon |
| `delivery_drivers_clean` | `delivery_drivers` | Safe driver directory/status without auth or push fields | `security_invoker=true`, `authenticated` select only, no anon |
| `branches_clean` | `branches`, `branch_delivery_profiles` | Operational branch directory and delivery profile | `security_invoker=true`, `authenticated` select only, no anon |
| `operations_tasks_clean` | `operations_tasks`, `branches`, optional user/profile DTO | Command Center task reporting | Phase C; `security_invoker=true`; role-scoped authenticated only |
| `quality_feedback_clean` | `feedback_responses` | Anonymized quality-feedback reporting | Phase C only after feedback RLS is hardened; no anon |
| `cash_differences_clean` | `cash_differences`, `branches` | Finance reconciliation reporting | Phase C; accounts/admin only by underlying RLS or secure RPC |
| `lost_sales_clean` | `lost_sales`, `branches`, `products`, `pharmacists` | Lost-sales reporting | Phase C; authenticated branch-scoped RLS |
| `shortages_clean` | `shortages`, `branches`, `products`, `pharmacists` | Shortage reporting | Phase C; authenticated branch-scoped RLS |
| `spin_activity_clean` | `spins`, `spin_prizes`, `branches` | Aggregate-only spin reporting | Phase C/D; no token/voucher/IP/customer contact fields |
| `app_users_clean` | `app_user_profiles`, `auth.users`, branches | Safe user/profile admin listing | Prefer existing `app_admin_list_users` RPC or private schema; do not expose as public view until proven safe |

## Phase B View Columns

### `delivery_orders_clean`

Suggested columns:

```text
id
created_at
updated_at
order_date
branch_id
branch_code
branch_name
pharmacist_id
pharmacist_name
driver_id
driver_code
driver_name
order_kind
delivery_status
value_bhd
payment_type
payment_type_label
payment_requires_block
block_number
area_name
governorate
is_outside_governorate
transfer_from_branch_code
transfer_from_branch_name
transfer_to_branch_code
transfer_to_branch_name
assigned_at
picked_up_at
delivered_at
cancelled_at
cancelled_reason
pickup_batch_id
batch_delivery_sequence
lifecycle_updated_at
```

Hide:

```text
order_value
payment_method
order_type
business_date
driver_name legacy source column
transfer_time
is_posted
deleted_at
created_by_branch_id
updated_by_branch_id
created_by
updated_by
lifecycle_updated_by
```

### `delivery_drivers_clean`

Suggested columns:

```text
id
driver_code
name
is_active
is_online
status_changed_at
last_seen_at
created_at
updated_at
```

Hide:

```text
phone
notes
auth_user_id
expo_push_token
updated_by
```

### `branches_clean`

Suggested columns:

```text
id
code
name
role
lat
lng
duty_radius_m
google_maps_link
is_spin_enabled
is_items_entry_enabled
is_kpi_dashboard_enabled
origin_block_number
core_radius_km
standard_radius_km
extended_radius_km
target_delivery_minutes
warning_delivery_minutes
is_delivery_enabled
delivery_profile_updated_at
```

Hide:

```text
whatsapp_number
nhra_license_no
cr_number
branch_manager_name
branch_delivery_profiles.notes
created_by
updated_by
```

## Tables Not To Expose

| Table | Reason |
|---|---|
| `spin_sessions` | Contains redeemable tokens/session state. |
| `customers` | Contains customer phone/email/name PII. |
| `voucher_shares` | Links voucher code, customer, and branch. |
| `branch_reviews` | Links customers and branch review behavior. |
| `auth.users` | Supabase Auth internals; use admin RPC/service DTO only. |
| `legacy_branch_password_backups` | May contain legacy password material. |
| `legacy_branch_scope_reference_backups` | Migration rollback/audit backup, not reporting data. |
| Raw `feedback_responses` | Free text and current overly broad read policy; use hardened/anonymized view later. |
| Raw `spins` | Voucher, customer, and IP/fraud fields. |
| Raw `cash_differences` | Finance comments and invoice references. |

## RLS And Security Review

Supabase/Postgres supports `with (security_invoker = true)` in the linked project because the project is running Postgres `17.6`.

Rules for every clean view:

- Use `security_invoker=true`.
- Grant `select` to `authenticated` only.
- Do not grant `anon`.
- Do not grant `insert`, `update`, or `delete`.
- Do not include service-role-only fields.
- Do not join `auth.users` from a public view unless role behavior is proven safe. Prefer the existing `app_admin_list_users` RPC.
- Do not expose passwords, tokens, API keys, push tokens, customer contact data, voucher codes, IP addresses, or auth internals.
- Keep underlying table RLS as the authority.

Current security blockers that must not be hidden by clean views:

| Blocker | Impact | Recommendation |
|---|---|---|
| `feedback_responses` has an `anon` select policy named `Admin read responses` | Raw quality feedback responses may be exposed too broadly | Harden before creating `quality_feedback_clean` |
| Spin tables have public-era policies on `customers`, `spins`, `spin_sessions`, `spin_prizes`, `branch_reviews`, and `voucher_shares` | Raw spin/customer/voucher data is unsafe for general clean views | Use aggregate-only views after policy review |
| Several legacy public policies still exist in the database advisor output | Views could normalize unsafe data without fixing access control | Fix RLS first, then expose clean shapes |

## Implementation Phases

### Phase A: Documentation Only

Status: complete in this audit pass.

- Audit schema, migrations, services, app code, and docs.
- Classify candidate tables.
- Propose views and hidden columns.
- Do not create migration.
- Do not apply remote changes.

### Phase B: Low-Risk Read-Only Clean Views

After approval, create a local-only migration for:

- `delivery_orders_clean`
- `delivery_drivers_clean`
- `branches_clean`

Validation:

```sql
select count(*) from public.delivery_orders_clean;
select * from public.delivery_orders_clean order by created_at desc limit 10;
select count(*) from public.delivery_drivers_clean;
select * from public.delivery_drivers_clean order by driver_code limit 10;
select count(*) from public.branches_clean;
select * from public.branches_clean order by code limit 10;
```

Role behavior:

- `anon`: denied.
- branch: branch-scoped by underlying RLS.
- driver: only driver-visible rows where underlying RLS allows it.
- owner/admin/manager: read according to existing table RLS helpers.
- writes: denied.

### Phase C: Admin/Reporting Views

Only after RLS review and QA:

- `operations_tasks_clean`
- `quality_feedback_clean`
- `cash_differences_clean`
- `lost_sales_clean`
- `shortages_clean`
- aggregate `spin_activity_clean`

### Phase D: Future Cleanup

Only after:

- clean views are validated;
- app code no longer depends on legacy fields;
- backups/PITR are confirmed;
- production owner signs off;
- explicit migration is reviewed.

Allowed future cleanup recommendations:

- mark old columns deprecated in docs;
- remove app reads of old fields;
- backfill missing clean fields;
- only later propose drops in a separate approved project.

Not allowed in this project status:

- drop columns;
- delete data;
- rewrite production data;
- replace raw tables;
- weaken RLS.

## Migration Decision

| Item | Status |
|---|---|
| Create Phase B migration | pending approval |
| Apply migration locally | pending approval |
| Apply migration remotely | not approved |
| Deploy | not approved |
| Commit/push | pending validation and approval |

## Final Status

```text
B) dedicated-client staging-ready only
```
