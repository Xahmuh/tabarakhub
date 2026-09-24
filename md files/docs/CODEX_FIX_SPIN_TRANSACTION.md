# Codex Prompt — Fix `execute_spin_transaction` Lint Error

---

## Context

`supabase db lint --linked --schema public --fail-on error` is failing with:

```
ERROR: ambiguous column reference "voucher_code" in function public.execute_spin_transaction
```

This is a **pre-existing** issue unrelated to recent migrations. It must be fixed before DB lint can be considered clean and before the branch can be promoted to production.

**Do not touch any other functions, tables, views, or migrations.**

---

## Goal

Fix the ambiguous `voucher_code` reference inside `public.execute_spin_transaction` by prefixing parameters with `p_` to distinguish them from column names.

---

## Step 1 — Read the current function definition

Run this in Supabase SQL Editor or via `supabase db remote` to get the current body:

```sql
SELECT pg_get_functiondef(oid)
FROM   pg_proc
WHERE  proname = 'execute_spin_transaction'
  AND  pronamespace = 'public'::regnamespace;
```

Copy the full output — you will need it for Step 2.

---

## Step 2 — Identify the ambiguity

Look for any parameter or local variable named `voucher_code` that is also used inside a query that touches a table column of the same name. For example:

```sql
-- ❌ Ambiguous — Postgres can't tell if this is the parameter or the column
WHERE voucher_code = voucher_code

-- ❌ Also ambiguous
WHERE t.voucher_code = voucher_code
```

---

## Step 3 — Create the fix migration

Create a new file:

```
supabase/migrations/20260618040000_fix_spin_transaction_ambiguity.sql
```

Inside it, write a `CREATE OR REPLACE FUNCTION` for `execute_spin_transaction` with these changes **only**:

1. Rename every parameter that conflicts with a column name by adding a `p_` prefix:
   - `voucher_code` → `p_voucher_code`
   - Apply the same rule to any other parameter that shares a name with a table column

2. Update every reference to that parameter inside the function body to use the new `p_` prefixed name.

3. Keep **everything else identical** — return type, language, security settings, logic, all other parameters.

### Example pattern:

```sql
CREATE OR REPLACE FUNCTION public.execute_spin_transaction(
  -- before:  voucher_code text,
  p_voucher_code text,   -- ✅ renamed
  -- ... other params unchanged
)
RETURNS /* same as before */
LANGUAGE plpgsql
SECURITY DEFINER  -- keep exactly as original
SET search_path = public
AS $$
BEGIN
  -- Replace all uses of the bare parameter name:
  -- before:  WHERE t.voucher_code = voucher_code
  -- after:
  WHERE t.voucher_code = p_voucher_code;  -- ✅ unambiguous

  -- ... rest of function body unchanged
END;
$$;
```

---

## Step 4 — Verify locally

```bash
# dry-run to confirm migration is valid SQL
supabase db push --linked --dry-run

# run lint again — should pass with no errors
supabase db lint --linked --schema public --fail-on error
```

---

## Completion Checklist

- [ ] Migration file created under `supabase/migrations/` with correct timestamp prefix
- [ ] No parameter or variable named `voucher_code` (unprefixed) remains in the function
- [ ] All column references in queries use table alias (e.g. `t.voucher_code`) not bare name
- [ ] `supabase db push --linked --dry-run` passes
- [ ] `supabase db lint --linked --schema public --fail-on error` passes
- [ ] `npm run typecheck` still passes
- [ ] `npm run build` still passes

---

## Constraints

- Do NOT modify any table, view, index, or RLS policy.
- Do NOT change the function's return type, language, or business logic.
- Do NOT edit any other function besides `execute_spin_transaction`.
- Do NOT touch any frontend files.
- If the function has overloads (multiple signatures), fix all of them.
