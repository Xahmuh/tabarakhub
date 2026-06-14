import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCorsPreflight, rejectDisallowedOrigin } from "../_shared/cors.ts";

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
    return json({ error: "Only active admins can reset branch passwords" }, 403);
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const userId = String(body.userId || "").trim();
  const password = String(body.password || "");

  if (!userId) {
    return json({ error: "User id is required" }, 400);
  }

  if (userId === requester.id) {
    return json({ error: "You cannot reset your own password here" }, 400);
  }

  if (password.length < 8) {
    return json({ error: "New password must be at least 8 characters" }, 400);
  }

  const { data: targetProfile, error: targetError } = await supabase
    .from("app_user_profiles")
    .select("role, is_active, branch_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (targetError) {
    return json({ error: targetError.message }, 400);
  }

  if (!targetProfile) {
    return json({ error: "No app profile found for this user" }, 404);
  }

  if (targetProfile.role !== "branch" || !targetProfile.branch_id) {
    return json({ error: "Only linked branch users can be assigned a new password from this panel" }, 400);
  }

  const { error: updateError } = await supabase.auth.admin.updateUserById(userId, {
    password,
  });

  if (updateError) {
    return json({ error: updateError.message }, 400);
  }

  return json({ ok: true });
});
