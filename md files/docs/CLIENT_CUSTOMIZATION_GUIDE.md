# Client Customization Guide

This app supports dedicated single-client deployments through safe frontend config and per-client Supabase projects. Do not implement shared multi-tenancy for this model.

## Change app name

Set:

```text
VITE_APP_NAME="Operations Hub"
```

or update the default in:

```text
config/clientConfig.ts
```

Prefer env overrides for repeatable deployments.

## Change client name

Set:

```text
VITE_CLIENT_NAME="CLIENT_NAME_HERE"
```

The login screen, app shell, footer, and document title read this value.

## Change logo

Preferred runtime option: use `Project Settings > Branding & logos` to set the pharmacy logo, HUB logo, browser icon, loading spinner, and optional footer logo.

These settings are stored in `system_settings` and are intended for dedicated-client configuration.

For deployment defaults, set:

```text
VITE_CLIENT_LOGO_URL="/logo.jpg"
```

Recommended: place the client logo in `public/` and reference it with an absolute path such as `/client-logo.png`.

## Change colors

Set safe frontend values:

```text
VITE_PRIMARY_COLOR="#B91c1c"
VITE_PRIMARY_HOVER_COLOR="#991b1b"
VITE_PRIMARY_DARK_COLOR="#7f1d1d"
VITE_PRIMARY_MUTED_COLOR="rgba(185, 28, 28, 0.05)"
VITE_ACCENT_COLOR="#0f172a"
```

The Tailwind `brand` color uses CSS variables populated from `clientConfig.ts`.

## Enable or disable modules

Set module flags in `.env.production`:

```text
VITE_MODULE_HR=true
VITE_MODULE_QUALITY_FEEDBACK=true
VITE_MODULE_REPORTS=true
VITE_MODULE_EXCEL_EXPORT=true
VITE_MODULE_BRANCH_DASHBOARD=true
VITE_MODULE_MANAGER_DASHBOARD=true
VITE_MODULE_ADMIN_DASHBOARD=true
VITE_MODULE_PRODUCTS=true
VITE_MODULE_SALES=true
VITE_MODULE_SPIN_WIN=true
VITE_MODULE_CASH_FLOW=true
VITE_MODULE_CASH_TRACKER=true
VITE_MODULE_CORPORATE_CODEX=true
VITE_MODULE_EMPLOYEE_CONTRIBUTIONS=true
VITE_MODULE_SETTINGS=true
VITE_MODULE_WORKFORCE=true
```

Module flags hide and block top-level navigation for the matching app sections. They do not replace Supabase RLS.

## Change module launcher order and badges

Use `Project Settings > Module Layout` to reorder the module launcher cards and set visible module badges such as `new module` or `Daily use`.

These settings are stored in `system_settings.module_display_settings` and are presentation-only. They do not grant access, hide security rules, or replace role/module permissions.

## Module exit buttons

Use `BackToModulesButton` from `app/shared/BackToModulesButton.tsx` for top-level module exits that return to the modules screen.

Do not use it for internal workflow back buttons, nested module backs, form-step backs, detail-page backs, or buttons that return to a parent module instead of the modules screen.

## Demo mode

Production and staging validation should use:

```text
VITE_DEMO_MODE=false
```

Use `VITE_DEMO_MODE=true` only for isolated demos where local fallback behavior and demo defaults are acceptable. Demo mode is not offline production support, and it must not be used to validate real client operational persistence.

## Configure currency and country

Set:

```text
VITE_CURRENCY="BHD"
VITE_COUNTRY="Bahrain"
VITE_DEFAULT_LOCALE="en"
```

If deeper currency formatting is needed later, update formatting utilities in one place rather than hardcoding values in pages.

## Prepare client-specific seed data

Use:

```text
docs/CLIENT_PROVISIONING_TEMPLATE.sql
```

Prepare:

```text
Branches
Pharmacists
Pharmacist-to-branch assignments if used
Feature permissions
Initial admin/manager/branch app_user_profiles
```

Use placeholders first, then replace with client-specific values in a private deployment copy.

## What not to customize directly

Do not customize these by editing random UI files:

```text
Supabase service-role keys
FUNCTION_SECRET
RLS policies
Auth/profile authorization rules
Hardcoded passwords
branches.password
Client-specific database IDs in source code
Shared tenant-routing logic
```

Keep client-specific deployment data in the client's Supabase project, `.env.production`, and approved seed SQL.
