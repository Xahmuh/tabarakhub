# Tabarak Online ↔ Tabarak Hub driver bridge (implementation contract)

An outbound assignment bridge is prepared in source but not deployed. WordPress/WooCommerce owns customer checkout, payment truth and branch dispatch; Hub Supabase owns driver duty and the driver's pickup/delivery actions. The prepared bridge selects the Hub driver UUID directly from its authenticated directory and resolves the Hub branch by its stable code. It synchronously imports one assigned delivery order before confirming the WordPress assignment. The durable outbox, inbound status sync, and financial reconciliation below remain the target design. The bridge must be server-to-server, never a service-role key in a mobile bundle.

## Identity map

- The prepared outbound bridge lists `delivery_drivers.id` UUIDs directly for Seller, so it never joins by a driver's name or phone. Older WordPress-only driver IDs remain on their original path. A managed mapping is still needed for backfilling those earlier assignments.
- The prepared bridge resolves the Hub branch by the verified WordPress branch code and rejects assignment if no matching operational branch exists. A managed branch-ID mapping remains a possible later hardening step.
- Persist `woocommerce_order_id -> delivery_orders.id (UUID)` with unique constraints on both sides. Tag Hub orders with source `tabarak_online` and the Woo order ID. Do not reuse a local Hub order number as the WooCommerce order ID.

## Outbound assignment

After an order is claimed and prepared, Seller sends a WordPress-only request to select an active driver. WordPress validates branch ownership, payment state, and ID maps, then puts an event in a durable outbox in the same transaction as the assignment state. A worker calls a restricted Hub Edge Function/RPC with a unique idempotency key `tabarak-online:<woo-id>:assign:<revision>`; it creates or updates exactly one Hub delivery order with customer name/phone, address, GPS, items, total, amount already paid, amount to collect, and tip. Hub then uses its existing driver notification path. Retry transient failures with backoff; never generate a second driver order on retry.

## Return events

Hub emits signed events carrying Hub UUID, Woo ID, driver UUID, state, occurred-at, and monotonic revision. WordPress verifies signature and mapping, deduplicates event ID, then updates the Woo order and the Seller event timeline:

- `picked_up`: capture pickup time and set the configured Woo out-for-delivery state.
- `delivered`: capture delivery time; only mark Woo completed after payment reconciliation permits it.
- `payment_collected`: record exact collected amount and method; reconcile the existing Woo payment state, never infer payment merely from delivery.
- `cancelled`/reassignment: propagate in both directions and prevent a stale event from reopening an already closed order.

Keep raw financial amounts in integer fils. Preparation = ready minus preparing; delivery = delivered minus picked-up. Attribute tip to the actual Hub driver only after a delivered, reconciled order. Expose failed/outstanding bridge events to WordPress admins with retry/audit controls.

## Staging acceptance cases

1. Same-block branch exclusivity, then nearest fallback for a distant block; card routes only to card-enabled Tabarak branches.
2. Two branch devices accept concurrently: exactly one claim and one Hub order.
3. Offline or failed Hub call: WordPress order remains claimed, outbox retries, no duplicate Hub order.
4. Driver gets complete customer/GPS/payment-due details; pickup/delivered timestamps return to WordPress and Seller.
5. COD/partial payment remains due until driver explicitly confirms collected amount; card never asks driver to collect.
6. Cancellation and driver reassignment reach both systems; older webhooks cannot reverse newer state.
7. Admin dashboard totals and per-driver tips reconcile against Woo and Hub source records.
