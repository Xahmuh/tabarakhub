import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCorsPreflight, rejectDisallowedOrigin } from "../_shared/cors.ts";

type AssignableRole = "admin" | "owner" | "branch" | "supervisor" | "warehouse" | "accounts" | "driver" | "employee";

const assignableRoles: AssignableRole[] = ["admin", "owner", "branch", "supervisor", "warehouse", "accounts", "driver", "employee"];

const friendlyDatabaseError = (message: string | undefined, role?: string) => {
  const normalized = message || "Database update failed";
  if (
    role === "owner" &&
    (normalized.includes("app_user_profiles_role_check") ||
      normalized.toLowerCase().includes("violates check constraint"))
  ) {
    return "Owner role is not enabled in the database yet. Apply the latest role/access migrations, then try again.";
  }
  return normalized;
};

serve(async (req) => {
  const json = (body: Record<string, unknown>, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });

  if (req.method === "OPTIONS") {
    return handleCorsPreflight(req);
  }

  const corsError = rejectDisallowedOrigin(req);
  if (corsError) return corsError;

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceRoleKey) {
    return json({ error: "Missing Supabase function environment" }, 500);
  }

  const authHeader = req.headers.get("Authorization");
  const bearer = authHeader?.replace("Bearer ", "");

  if (!bearer) {
    return json({ error: "Missing Authorization header" }, 401);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: authData, error: authError } = await supabase.auth.getUser(bearer);
  const requester = authData.user;

  if (authError || !requester) {
    return json({ error: "Unauthorized" }, 401);
  }

  const { data: requesterProfile, error: requesterError } = await supabase
    .from("app_user_profiles")
    .select("role, is_active")
    .eq("user_id", requester.id)
    .maybeSingle();

  if (
    requesterError ||
    !requesterProfile?.is_active ||
    !["admin", "manager"].includes(requesterProfile.role)
  ) {
    return json({ error: "Only active admins can create users" }, 403);
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const email = String(body.email || "").trim().toLowerCase();
  const password = String(body.password || "");
  const role = String(body.role || "") as AssignableRole;
  const branchId = body.branchId ? String(body.branchId) : null;
  const driverId = body.driverId ? String(body.driverId) : null;
  const employeeId = body.employeeId ? String(body.employeeId) : null;
  const requestedIsActive = body.isActive !== false;
  const supervisorBranchIds = Array.isArray(body.supervisorBranchIds)
    ? body.supervisorBranchIds.map((id: unknown) => String(id)).filter(Boolean)
    : [];

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return json({ error: "Valid email is required" }, 400);
  }

  if (!assignableRoles.includes(role)) {
    return json({ error: "Invalid role" }, 400);
  }

  if (role !== "employee" && password.length < 8) {
    return json({ error: "Temporary password must be at least 8 characters" }, 400);
  }

  // Personal portals are enabled only after their row-scoped policies ship.
  const isActive = role === "admin" ? true : role === "employee" ? false : requestedIsActive;

  if (role === "branch" && !branchId) {
    return json({ error: "Branch role requires a linked branch" }, 400);
  }

  if (role === "driver" && !driverId) {
    return json({ error: "Driver role requires a linked delivery driver" }, 400);
  }

  if (role === "employee" && !employeeId) {
    return json({ error: "Employee role requires a linked employee record" }, 400);
  }

  const branchIdsToCheck = role === "branch"
    ? [branchId]
    : role === "supervisor"
      ? supervisorBranchIds
      : [];

  if (branchIdsToCheck.length > 0) {
    const { data: branchRows, error: branchError } = await supabase
      .from("branches")
      .select("id")
      .eq("role", "branch")
      .in("id", branchIdsToCheck);

    if (branchError) return json({ error: branchError.message }, 400);

    const found = new Set((branchRows || []).map((row) => row.id));
    const missing = branchIdsToCheck.filter((id) => id && !found.has(id));
    if (missing.length > 0) {
      return json({ error: "One or more selected branches are invalid" }, 400);
    }
  }

  if (role === "driver") {
    const { data: driverRow, error: driverError } = await supabase
      .from("delivery_drivers")
      .select("id, auth_user_id, is_active")
      .eq("id", driverId)
      .maybeSingle();

    if (driverError) return json({ error: driverError.message }, 400);
    if (!driverRow?.is_active) return json({ error: "Selected delivery driver is inactive or unavailable" }, 400);
    if (driverRow.auth_user_id) return json({ error: "Selected delivery driver is already linked to a login user" }, 400);
  }

  if (role === "employee") {
    const { data: employeeRow, error: employeeError } = await supabase
      .from("employees")
      .select("id, status")
      .eq("id", employeeId)
      .maybeSingle();
    if (employeeError) return json({ error: employeeError.message }, 400);
    if (!employeeRow || employeeRow.status === "Inactive") {
      return json({ error: "Selected employee is inactive or unavailable" }, 400);
    }
    const { data: existingLink, error: linkLookupError } = await supabase
      .from("app_user_employee_links")
      .select("user_id")
      .eq("employee_id", employeeId)
      .maybeSingle();
    if (linkLookupError) return json({ error: linkLookupError.message }, 400);
    if (existingLink) return json({ error: "Selected employee already has a login" }, 409);

    // A disabled app profile still receives a valid Supabase Auth token and
    // could reach legacy authenticated-wide policies. Stage identity only.
    const { data: pending, error: stageError } = await supabase
      .from("pending_employee_accounts")
      .insert({ employee_id: employeeId, email, staged_by: requester.id })
      .select("id")
      .single();
    if (stageError) return json({ error: stageError.message }, 409);
    return json({ pendingEmployeeAccountId: pending.id, employeeId, email, status: "pending" }, 201);
  }

  const { data: created, error: createError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      created_by_admin_id: requester.id,
      created_from: "tabarak_hub_access_control",
    },
  });

  if (createError || !created.user) {
    return json({ error: createError?.message || "Failed to create Auth user" }, 400);
  }

  const userId = created.user.id;

  const { error: profileError } = await supabase
    .from("app_user_profiles")
    .insert({
      user_id: userId,
      role,
      branch_id: role === "branch" ? branchId : null,
      is_active: isActive,
    });

  if (profileError) {
    await supabase.auth.admin.deleteUser(userId);
    return json({ error: friendlyDatabaseError(profileError.message, role) }, 400);
  }

  if (role === "supervisor" && supervisorBranchIds.length > 0) {
    const { error: supervisorError } = await supabase
      .from("supervisor_branches")
      .insert(supervisorBranchIds.map((id: string) => ({
        supervisor_user_id: userId,
        branch_id: id,
        created_by: requester.id,
      })));

    if (supervisorError) {
      await supabase.from("app_user_profiles").delete().eq("user_id", userId);
      await supabase.auth.admin.deleteUser(userId);
      return json({ error: supervisorError.message }, 400);
    }
  }

  if (role === "driver" && driverId) {
    const { error: driverLinkError } = await supabase
      .from("delivery_drivers")
      .update({
        auth_user_id: userId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", driverId);

    if (driverLinkError) {
      await supabase.from("app_user_profiles").delete().eq("user_id", userId);
      await supabase.auth.admin.deleteUser(userId);
      return json({ error: driverLinkError.message }, 400);
    }
  }

  if (role === "employee" && employeeId) {
    const { error: employeeLinkError } = await supabase
      .from("app_user_employee_links")
      .insert({ user_id: userId, employee_id: employeeId, linked_by: requester.id });
    if (employeeLinkError) {
      await supabase.from("app_user_profiles").delete().eq("user_id", userId);
      await supabase.auth.admin.deleteUser(userId);
      return json({ error: employeeLinkError.message }, 400);
    }
  }

  return json({
    user: {
      userId,
      email: created.user.email,
      role,
      branchId: role === "branch" ? branchId : null,
      driverId: role === "driver" ? driverId : null,
      employeeId: role === "employee" ? employeeId : null,
      isActive,
      createdAt: created.user.created_at,
    },
  });
});
