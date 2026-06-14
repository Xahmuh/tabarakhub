# System Settings Failure Behavior

Current status:

```text
B) dedicated-client staging-ready only
```

## Expected Behavior

System settings control operational behavior such as maintenance mode, footer branding, login page badges, and POS instruction copy. The application must distinguish between:

```text
No settings row:
Use first-run defaults. This is acceptable because the table exists and returned a valid empty result.
```

```text
Fetch error:
Do not silently return defaults. Surface the error to the UI so a manager can resolve migrations, RLS, schema cache, or connectivity.
```

## Why This Matters

Maintenance mode must not fail open silently. If the settings query fails because a column is missing, RLS blocks access, or the network/schema cache is unhealthy, the app should not pretend that maintenance is off or that default footer/POS copy is saved.

## UI Behavior

When system settings cannot be loaded:

```text
The app shows a visible settings warning.
Project Settings > System shows the normalized error and blocks maintenance/footer/login badge/POS settings edits.
The rest of the app remains usable where safe.
Defaults may be used only as temporary in-app fallbacks, not as saved settings.
```

## Deployment Requirement

Before deploying a dedicated-client build:

```text
All system_settings migrations must be applied.
Supabase schema cache must be refreshed.
RLS policies must allow the intended read path.
Managers must verify that maintenance mode, footer text, login badges, and POS instruction copy load from the database.
```
