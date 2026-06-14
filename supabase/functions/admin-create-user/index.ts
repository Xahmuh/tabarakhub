import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCorsPreflight, rejectDisallowedOrigin } from "../_shared/cors.ts";

type AssignableRole = "manager" | "owner" | "supervisor" | "warehouse" | "branch";

const assignableRoles: AssignableRole[] = ["manager", "owner", "supervisor", "warehouse", "branch"];

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

  if (requesterError || !requesterProfile?.is_active || requesterProfile.role !== "manager") {
    return json({ error: "Only active managers can create users" }, 403);
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
  const isActive = body.isActive !== false;
  const supervisorBranchIds = Array.isArray(body.supervisorBranchIds)
    ? body.supervisorBranchIds.map((id: unknown) => String(id)).filter(Boolean)
    : [];

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return json({ error: "Valid email is required" }, 400);
  }

  if (password.length < 8) {
    return json({ error: "Temporary password must be at least 8 characters" }, 400);
  }

  if (!assignableRoles.includes(role)) {
    return json({ error: "Invalid role" }, 400);
  }

  if (role === "branch" && !branchId) {
    return json({ error: "Branch role requires a linked branch" }, 400);
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

  const { data: created, error: createError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      created_by_manager_id: requester.id,
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
    return json({ error: profileError.message }, 400);
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

  return json({
    user: {
      userId,
      email: created.user.email,
      role,
      branchId: role === "branch" ? branchId : null,
      isActive,
      createdAt: created.user.created_at,
    },
  });
});
