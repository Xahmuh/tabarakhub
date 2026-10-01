import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.108.2";
import { getCorsHeaders, handleCorsPreflight, rejectDisallowedOrigin } from "../_shared/cors.ts";

const invalidCredentials = { error: "Invalid login credentials" };

serve(async (req) => {
  const json = (body: Record<string, unknown>, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json", "Cache-Control": "no-store" },
    });

  if (req.method === "OPTIONS") return handleCorsPreflight(req);
  const corsError = rejectDisallowedOrigin(req);
  if (corsError) return corsError;
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  let input: unknown;
  try {
    input = await req.json();
  } catch {
    return json(invalidCredentials, 401);
  }

  const body = input && typeof input === "object" ? input as Record<string, unknown> : {};
  const identifier = typeof body.identifier === "string" ? body.identifier.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (!identifier || identifier.length > 128 || !password || password.length > 256) {
    return json(invalidCredentials, 401);
  }

  const url = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !anonKey || !serviceKey) return json({ error: "Login unavailable" }, 503);

  const clientOptions = { auth: { autoRefreshToken: false, persistSession: false } };
  const admin = createClient(url, serviceKey, clientOptions);
  const auth = createClient(url, anonKey, clientOptions);

  let email: string | null = null;
  if (identifier.includes("@")) {
    email = identifier.toLowerCase();
  } else {
    const { data, error } = await admin.rpc("app_driver_resolve_login_identifier", {
      p_identifier: identifier,
    });
    if (!error && typeof data === "string") email = data.trim().toLowerCase();
  }

  // Run every valid-shaped request through Auth so an unknown code gets the
  // same response path as a wrong password. Never return the resolved email.
  const { data: signIn, error: signInError } = await auth.auth.signInWithPassword({
    email: email || "unknown-driver@invalid.tabarak.local",
    password,
  });
  if (signInError || !signIn.user || !signIn.session) return json(invalidCredentials, 401);

  const [profileResult, driverResult] = await Promise.all([
    admin.from("app_user_profiles")
      .select("role, is_active")
      .eq("user_id", signIn.user.id)
      .maybeSingle(),
    admin.from("delivery_drivers")
      .select("id, is_active")
      .eq("auth_user_id", signIn.user.id)
      .maybeSingle(),
  ]);
  if (profileResult.error || driverResult.error ||
      profileResult.data?.role !== "driver" || !profileResult.data.is_active ||
      !driverResult.data?.is_active) {
    return json(invalidCredentials, 401);
  }

  return json({
    access_token: signIn.session.access_token,
    refresh_token: signIn.session.refresh_token,
  });
});
