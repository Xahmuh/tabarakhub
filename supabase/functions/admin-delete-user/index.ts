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
    return json({ error: "Only active admins can delete users" }, 403);
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const userId = String(body.userId || "").trim();

  if (!userId) {
    return json({ error: "User id is required" }, 400);
  }

  if (userId === requester.id) {
    return json({ error: "You cannot delete your own admin account" }, 400);
  }

  const { data: targetProfile, error: targetError } = await supabase
    .from("app_user_profiles")
    .select("role, is_active")
    .eq("user_id", userId)
    .maybeSingle();

  if (targetError) {
    return json({ error: targetError.message }, 400);
  }

  if (!targetProfile) {
    return json({ error: "No app profile found for this user" }, 404);
  }

  if (["admin", "manager"].includes(targetProfile.role)) {
    return json({ error: "Admin accounts cannot be deleted from the admin panel" }, 400);
  }

  await supabase.from("supervisor_branches").delete().eq("supervisor_user_id", userId);
  const { error: deleteError } = await supabase.auth.admin.deleteUser(userId);
  if (deleteError) {
    return json({ error: deleteError.message }, 400);
  }

  await supabase.from("app_user_profiles").delete().eq("user_id", userId);

  return json({ ok: true });
});
