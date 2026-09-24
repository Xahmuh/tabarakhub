# Module Layout Settings

Current status:

```text
B) dedicated-client staging-ready only
```

## Purpose

Module Layout lets an admin/manager reorder the Operations Modules launcher cards and choose whether a small red badge is shown on each card.

This feature is presentation-only. It does not grant access, remove access, bypass RLS, replace role defaults, or replace branch/user module permissions.

## Storage

Settings are stored on the single global system settings row:

```text
public.system_settings.id = global
public.system_settings.module_display_settings jsonb not null default {"items":[]}
```

The expected JSON shape is:

```json
{
  "items": [
    {
      "key": "delivery",
      "order": 160,
      "badge": "new module",
      "badgeStyle": "red"
    }
  ]
}
```

Allowed badge styles are:

```text
hidden
red
```

Badge text is trimmed and capped at 32 characters.

## Runtime Behavior

The suite page still filters visible modules with the existing access checks before applying layout order:

```text
isModuleEnabled(...)
checkPermission(...)
role-specific visibility checks
```

Only visible cards are sorted by `module_display_settings.items[].order`. A hidden or unauthorized module cannot be made visible by moving it in Module Layout.

Unknown module keys are ignored. Missing, empty, or invalid settings normalize back to the default module list.

## Admin UI

Path:

```text
Project Settings > Module Layout
```

Controls:

```text
Move up/down
Badge text
Show badge
Reset draft
Save layout
Preview order
```

Reset draft only resets the unsaved UI draft. It does not write to Supabase until Save layout is clicked.

## Migration Validation

Validated on 2026-06-14 against the currently linked Supabase project.

Migration:

```text
supabase/migrations/20260614200000_module_display_settings.sql
```

Review result:

```text
Adds public.system_settings.module_display_settings as jsonb.
Uses add column if not exists.
Sets default {"items":[]}.
Backfills only the global row with coalesce.
Adds a presentation-only column comment.
Does not alter RLS, grants, role permissions, branch permissions, or app_user_feature_permissions.
Does not delete or overwrite other system settings.
```

Linked database validation:

```text
module_display_settings column exists.
data_type: jsonb
is_nullable: NO
column_default: '{"items": []}'::jsonb
global row value_type: object
global row value: {"items":[]}
```

Supabase migration history:

```text
20260614190000_admin_role_access_model.sql: local and remote aligned
20260614193000_harden_app_user_feature_permissions_grants.sql: local and remote aligned
20260614200000_module_display_settings.sql: local and remote aligned
```

No `supabase db push` was run during this validation pass.

## RLS And Grants

The Module Layout migration does not change RLS or table grants.

Current linked `public.system_settings` policies observed on 2026-06-14:

```text
system settings public read: SELECT to anon/authenticated, using true
system settings manage authenticated: ALL to authenticated, current_app_can_manage()
system settings manage maintenance controllers: ALL to authenticated, current_app_can_control_maintenance()
```

Current linked grants observed on 2026-06-14:

```text
anon: SELECT
authenticated: SELECT, INSERT, UPDATE
service_role: full table privileges
```

## Browser QA

Authenticated browser QA is pending because no authenticated admin/manager browser session or usable credentials were available in this pass.

Pending checks:

```text
Open Project Settings > Module Layout.
Reorder cards and save.
Confirm the Operations Modules page reflects the order.
Confirm badge show/hide and badge text behavior.
Confirm unauthorized modules remain hidden for branch users.
Confirm no console/network errors.
```

Final status remains:

```text
B) dedicated-client staging-ready only
```
