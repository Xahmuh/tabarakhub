# Delivery Driver Mobile MVP Runbook

## What Is Implemented

- `driver` login role in `app_user_profiles`
- `delivery_drivers.auth_user_id` link to Supabase Auth
- Driver online/offline shifts through `delivery_driver_shifts`
- Daily driver stats through `delivery_driver_daily_stats`
- Driver mobile RPCs:
  - `app_driver_get_session`
  - `app_driver_get_active_orders`
  - `app_driver_start_shift`
  - `app_driver_end_shift`
  - `app_driver_transition_order`
  - `app_driver_register_push_token`
- Web recording now uses `app_delivery_record_and_assign_order` when a driver is selected, so new delivery orders become `assigned` immediately.
- `apps/driver-mobile` Expo app with login, shift toggle, assigned orders, pickup/delivered/cancel actions, and offline action queue.

## Create A Driver Login

1. Open `Settings & Permissions > Users & Roles`.
2. Click `Add login user`.
3. Pick role `Driver`.
4. Select the matching delivery driver profile.
5. Set a temporary password.
6. The driver signs into the mobile app with that email/password.

## Run Mobile App Locally

```bash
cd apps/driver-mobile
copy .env.example .env
npm install
npm run start
```

Set these values in `apps/driver-mobile/.env`:

```bash
EXPO_PUBLIC_SUPABASE_URL=https://PROJECT_REF.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=PUBLIC_ANON_KEY_HERE
```

## Operational Flow

1. Branch records a delivery order and selects the known driver.
2. The order is saved as `assigned` and a lifecycle event is written.
3. The driver opens the mobile app and sees assigned orders.
4. Driver marks:
   - `Picked up`
   - `Delivered`
   - `Cancel`
5. Dispatch and analytics use the same `delivery_orders` and `delivery_order_events` data.

## Important Rules

- Newly assigned orders can still be deleted from Recording if they have not been picked up, delivered, or cancelled.
- Once a driver marks an order picked up or delivered, the order is lifecycle traceability and should be closed through Dispatch/mobile status changes, not hard-deleted.
- The mobile app does not add GPS tracking. It records discrete operational events only.
