import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.108.2";

type Json = Record<string, unknown>;
const response = (body: Json, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
});
const text = (value: unknown, max: number) => typeof value === "string" ? value.trim().slice(0, max) : "";
const object = (value: unknown): Json => value && typeof value === "object" && !Array.isArray(value) ? value as Json : {};
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function sameSecret(received: string, expected: string) {
  if (!expected || received.length !== expected.length) return false;
  let difference = 0;
  for (let index = 0; index < expected.length; index++) difference |= received.charCodeAt(index) ^ expected.charCodeAt(index);
  return difference === 0;
}

serve(async (request) => {
  if (request.method !== "POST") return response({ error: "Method not allowed" }, 405);
  const secret = Deno.env.get("SELLER_DRIVER_BRIDGE_SECRET") || "";
  if (secret.length < 32 || !sameSecret(request.headers.get("x-seller-bridge-secret") || "", secret)) {
    return response({ error: "Unauthorized" }, 401);
  }
  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceKey) return response({ error: "Driver bridge unavailable" }, 503);
  const database = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

  let body: Json;
  try { body = object(await request.json()); }
  catch { return response({ error: "Invalid request" }, 400); }

  if (body.action === "staff_directory") {
    const [
      { data: branches, error: branchError },
      { data: pharmacists, error: pharmacistError },
      { data: pharmacistLinks, error: linkError },
      { data: drivers, error: driverError },
    ] = await Promise.all([
      database.from("branches").select("id,code").eq("role", "branch").order("code"),
      database.from("pharmacists").select("id,code,name,is_active").order("code"),
      database.from("pharmacist_branches").select("pharmacist_id,branch_id"),
      database.from("delivery_drivers").select("id,name,phone,is_active,auth_user_id").order("name"),
    ]);
    if (branchError || pharmacistError || linkError || driverError) {
      return response({ error: "Staff directory unavailable" }, 503);
    }
    return response({
      branches: (branches || []).map(branch => ({ id: branch.id, code: branch.code || "" })),
      pharmacists: (pharmacists || []).map(person => ({
        id: person.id, code: person.code || "", name: person.name || "", active: person.is_active === true,
      })),
      pharmacist_links: (pharmacistLinks || []).map(link => ({
        pharmacist_id: link.pharmacist_id, branch_id: link.branch_id,
      })),
      drivers: (drivers || []).map(driver => ({
        id: driver.id, name: driver.name || "", phone: driver.phone || "",
        active: driver.is_active === true, app_account: driver.auth_user_id != null,
      })),
    });
  }

  if (body.action === "pharmacists") {
    const branchCode = text(body.branch_code, 40).toUpperCase();
    if (!/^[A-Za-z0-9_-]{1,40}$/.test(branchCode)) return response({ error: "Invalid branch" }, 422);
    const { data: branch, error: branchError } = await database.from("branches")
      .select("id").ilike("code", branchCode).eq("role", "branch").maybeSingle();
    if (branchError || !branch) return response({ error: "Branch directory unavailable" }, 503);
    const [{ data: pharmacists, error: pharmacistError }, { data: assignments, error: assignmentError }] = await Promise.all([
      database.from("pharmacists").select("id,code,name,is_active").eq("is_active", true).order("name"),
      database.from("pharmacist_branches").select("pharmacist_id").eq("branch_id", branch.id),
    ]);
    if (pharmacistError || assignmentError) return response({ error: "Pharmacist directory unavailable" }, 503);
    const assignedIds = new Set((assignments || []).map(item => item.pharmacist_id));
    const branchHasAssignments = assignedIds.size > 0;
    const eligible = (pharmacists || []).filter(person => !branchHasAssignments || assignedIds.has(person.id));
    return response({ items: eligible.map(person => ({ code: person.code || "", name: person.name || "" })) });
  }

  if (body.action === "drivers") {
    const branchCode = text(body.branch_code, 40).toUpperCase();
    let branchId: string | null = null;
    if (branchCode !== "") {
      if (!/^[A-Za-z0-9_-]{1,40}$/.test(branchCode)) return response({ error: "Invalid branch" }, 422);
      const { data: branch, error: branchError } = await database.from("branches")
        .select("id").ilike("code", branchCode).eq("role", "branch").maybeSingle();
      if (branchError || !branch) return response({ error: "Branch directory unavailable" }, 503);
      branchId = branch.id;
    }

    const [{ data: drivers, error: driverError }, { data: assignments, error: assignmentError }] = await Promise.all([
      database.from("delivery_drivers").select("id,name,phone,driver_code,is_online")
        .eq("is_active", true).not("auth_user_id", "is", null).order("name"),
      branchId
        ? database.from("delivery_driver_branches").select("driver_id").eq("branch_id", branchId)
        : Promise.resolve({ data: [] as { driver_id: string }[], error: null }),
    ]);
    if (driverError || assignmentError) return response({ error: "Driver directory unavailable" }, 503);

    const assignedIds = new Set((assignments || []).map(item => item.driver_id));
    const branchHasAssignments = branchId !== null && assignedIds.size > 0;
    // Respect the branch's driver-area links when configured; otherwise show all active app drivers.
    const eligibleDrivers = (drivers || []).filter(driver => !branchHasAssignments || assignedIds.has(driver.id));
    const driverIds = eligibleDrivers.map(driver => driver.id);
    let onDutyIds = new Set<string>();
    if (driverIds.length) {
      const { data: shifts, error: shiftError } = await database.from("delivery_driver_shifts")
        .select("driver_id,started_at").in("driver_id", driverIds).is("ended_at", null)
        .order("started_at", { ascending: false });
      if (shiftError) return response({ error: "Driver attendance unavailable" }, 503);
      onDutyIds = new Set((shifts || []).map(shift => shift.driver_id));
    }
    return response({ items: eligibleDrivers.map(driver => ({
      id: driver.id, name: driver.name, phone: driver.phone || "", code: driver.driver_code || "",
      is_on_duty: driver.is_online === true && onDutyIds.has(driver.id),
    })) });
  }

  if (body.action === "status") {
    const orderId = text(body.order_id, 20);
    if (!/^[0-9]{1,20}$/.test(orderId)) return response({ error: "Invalid order" }, 422);
    const { data, error } = await database.from("delivery_orders")
      .select("id,delivery_status,picked_up_at,delivered_at,cancelled_at")
      .eq("external_source", "woocommerce").eq("external_order_id", orderId).maybeSingle();
    if (error) return response({ error: "Could not check delivery status" }, 503);
    return response({ order: data || null });
  }

  if (body.action === "statuses") {
    const orderIds = Array.isArray(body.order_ids) ? body.order_ids.map(value => text(value, 20)) : [];
    if (orderIds.length > 100 || orderIds.some(id => !/^[0-9]{1,20}$/.test(id))) {
      return response({ error: "Invalid orders" }, 422);
    }
    if (orderIds.length === 0) return response({ orders: [] });
    const { data, error } = await database.from("delivery_orders")
      .select("external_order_id,delivery_status,picked_up_at,delivered_at,cancelled_at")
      .eq("external_source", "woocommerce").in("external_order_id", orderIds);
    if (error) return response({ error: "Could not check delivery statuses" }, 503);
    return response({ orders: data || [] });
  }

  if (body.action !== "assign") return response({ error: "Unknown action" }, 400);
  const order = object(body.order);
  const customer = object(order.customer);
  const location = Array.isArray(order.location) ? order.location : null;
  const latitude = location && location[0] != null && Number.isFinite(Number(location[0])) ? Number(location[0]) : null;
  const longitude = location && location[1] != null && Number.isFinite(Number(location[1])) ? Number(location[1]) : null;
  const driverId = text(body.driver_id, 64);
  const orderId = text(order.id, 20);
  const branchCode = text(order.branch_code, 40).toUpperCase();
  const total = Number(order.total);
  const amountDueFils = Number(order.amount_due_fils);
  const paymentMethod = text(order.payment_method, 16);
  const paymentType = paymentMethod === "wallet" ? "WALLET" : paymentMethod === "card" ? "CARD" : "CASH";
  const date = text(order.created_at, 32).slice(0, 10);
  if (!uuidPattern.test(driverId) || !/^[0-9]{1,20}$/.test(orderId)
    || !/^[A-Za-z0-9_-]{1,40}$/.test(branchCode)
    || !/^\d{4}-\d{2}-\d{2}$/.test(date)
    || !Number.isFinite(total) || total <= 0 || !Number.isFinite(amountDueFils)
    || amountDueFils < 0 || amountDueFils > Math.round(total * 1000)
    || !["wallet", "card", "cod"].includes(paymentMethod)
    || !text(customer.phone, 60) || latitude === null || longitude === null
    || latitude < 25.5 || latitude > 26.7 || longitude < 50.2 || longitude > 51.0) {
    return response({ error: "Invalid order or driver details" }, 422);
  }

  const { data: driver, error: driverError } = await database.from("delivery_drivers")
    .select("id,name,phone,expo_push_token").eq("id", driverId).eq("is_active", true)
    .not("auth_user_id", "is", null).maybeSingle();
  if (driverError || !driver) return response({ error: "Driver has no active app account" }, 422);

  const { data: existing, error: existingError } = await database.from("delivery_orders")
    .select("id,driver_id,delivery_status").eq("external_source", "woocommerce")
    .eq("external_order_id", orderId).maybeSingle();
  if (existingError) return response({ error: "Could not verify the current driver assignment" }, 503);
  const amountReceived = Math.max(0, Math.round(total * 1000) - Math.round(amountDueFils)) / 1000;
  const { data: deliveryOrderId, error } = await database.rpc("app_seller_import_assigned_order", {
    p_external_order_id: orderId,
    p_order_number: text(order.number, 80) || orderId,
    p_branch_code: branchCode,
    p_driver_id: driverId,
    p_order_date: date,
    p_value_bhd: total,
    p_payment_type: paymentType,
    p_amount_received_bhd: amountReceived,
    p_block_number: text(order.block, 16) || null,
    p_pharmacist_name: text(order.pharmacist, 150) || null,
    p_customer_name: text(customer.name, 160) || null,
    p_customer_phone: text(customer.phone, 60) || null,
    p_customer_address: text(order.address, 500) || null,
    p_customer_lat: latitude,
    p_customer_lng: longitude,
    p_notes: text(order.note, 1000) || null,
  });
  if (error || !deliveryOrderId) {
    const message = String(error?.message || "");
    const known = ["no matching Driver app branch", "already assigned to another driver", "Only unpicked orders can be reassigned", "Driver has no active app account", "Payment type is not available"]
      .find(part => message.includes(part));
    return response({ error: known || "Could not deliver order to Driver app" }, known ? 409 : 503);
  }
  const pushToken = typeof driver.expo_push_token === "string" ? driver.expo_push_token : "";
  const assignmentChanged = !existing || existing.driver_id !== driverId;
  if (assignmentChanged && /^ExpoPushToken\[[A-Za-z0-9_-]{8,128}\]$/.test(pushToken)) {
    // The app also polls its assigned orders, so a push failure cannot hide the order.
    try {
      await fetch("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        signal: AbortSignal.timeout(2000),
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: pushToken, title: "New delivery order",
          body: `Order #${text(order.number, 80) || orderId} is assigned to you.`,
          data: { orderId: deliveryOrderId }, sound: "default", priority: "high" }),
      });
    } catch { /* Polling remains available when push delivery is unavailable. */ }
  }
  return response({ delivery_order_id: deliveryOrderId, driver: {
    id: driver.id, name: driver.name, phone: driver.phone || "",
  } });
});
