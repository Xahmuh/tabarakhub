# Contributions Storage / RPC Grants Recovery Notes

Migration:

```text
supabase/migrations/20260614133000_harden_contributions_storage_and_rpc_grants.sql
```

Purpose:

```text
Make the contributions bucket private.
Remove public/anon storage object policies for contributions.
Keep authenticated internal read.
Gate contribution object writes behind current_app_can_manage().
Remove direct anon/public EXECUTE from internal helper/RPC functions.
Keep only reviewed public Spin customer-flow RPCs callable by anon.
```

## Recovery Path

This migration does not delete files or table rows. If a regression appears,
prefer this recovery order:

```text
1. Confirm the authenticated user has a valid active manager profile if upload/update/delete fails.
2. Confirm the user has any active authenticated profile if contribution file download fails.
3. Confirm old employee_contributions.file_path values are either storage object paths or old public Storage URLs; the app now normalizes both.
4. Re-run docs/POST_MIGRATION_SECURITY_CHECKS.sql to inspect storage policies and public RPC allowlist.
5. If production access is critically blocked, restore the database/storage policy state from the pre-change Supabase backup or point-in-time restore.
```

Do not re-enable public upload as a normal fix. A temporary public-storage
rollback would reintroduce the production blocker and requires explicit release
owner approval, a time limit, and a follow-up hardening plan.

## Public RPC Allowlist

The only intended anon-callable public RPCs after this migration are:

```text
validate_spin_token(text)
execute_spin_transaction(text, text, text, text, text)
execute_spin_transaction(text, text, text, text, text, text)
generate_spin_session_from_branch_code(text)
```

All internal `current_app_*`, `app_admin_*`, branch-login approval,
operations-task helper, and trigger/helper functions should not be directly
executable by anon.
