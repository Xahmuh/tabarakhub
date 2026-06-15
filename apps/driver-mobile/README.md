# Tabarak Driver Mobile

Expo MVP for delivery drivers.

## Setup

1. Copy `.env.example` to `.env`.
2. Fill `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY`.
3. Run:

```bash
npm install
npm run start
```

The driver must have:

- an Auth login user with role `driver`
- a linked `delivery_drivers.auth_user_id`
- active delivery orders assigned through the web dashboard

## MVP Scope

- Driver login
- Start/end shift
- View assigned and picked-up orders
- Mark picked up, delivered, or cancelled
- Queue status changes when offline and sync later
