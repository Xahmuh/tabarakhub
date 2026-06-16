# Driver Mobile Preview Plan

Checked on: 2026-06-16

Final status:

```text
B) dedicated-client staging-ready only
```

## Context

Commit `152a429 feat: improve driver mobile transfer and history UX` is pushed to `origin/main`, but the tested Vercel preview at:

```text
https://tabarakhub-8zesyh2lw-ames-projects-7ab0c189.vercel.app
```

serves the root Tabarak Hub SPA, not a separately proven `apps/driver-mobile` Expo runtime. Candidate driver paths returned the same root SPA shell, and the root bundle scan did not find the new Driver Mobile history strings.

This plan defines safe ways to expose and validate the real Driver Mobile runtime before any production promotion.

## Required Guardrails

- Do not promote production until Driver Mobile History and Transfer runtime QA passes on a reachable driver runtime.
- Do not apply migrations as part of preview setup; current linked migration history is aligned through `20260616100000`.
- Do not create production test orders unless explicitly approved for a controlled authenticated QA pass.
- Do not store passwords, session cookies, Supabase keys, service-role keys, or Vercel bypass tokens in docs, commits, screenshots, or chat.
- Use environment variable names only in documentation, never real values.

## Option A — Expo Go / LAN / Tunnel

Use this for the fastest real driver runtime QA.

### Start

```bash
cd apps/driver-mobile
npm install
npm run start
```

Choose the Expo CLI connection mode that fits the tester:

```bash
npx expo start --lan
npx expo start --tunnel
```

### Environment

Create `apps/driver-mobile/.env` from `apps/driver-mobile/.env.example` and provide values locally only:

```text
EXPO_PUBLIC_SUPABASE_URL
EXPO_PUBLIC_SUPABASE_ANON_KEY
```

### QA Steps

- Open the project QR code in Expo Go on a real phone.
- Log in with an approved Driver session entered manually by the operator.
- Validate Driver History rows, detail sheet, filters, refresh persistence, and duplicate handling.
- Validate Internal Transfer setup opens and lists real registered branches in `From` and `To`.
- Validate create action remains blocked until duty is active and source/destination branches differ.
- Do not create transfer/test orders unless the operator explicitly approves controlled QA data.

### Limits

- Expo Go is suitable for fast UI/runtime validation.
- Custom native notification sounds may not behave exactly like a production build in Expo Go.
- Push notification delivery and native sound behavior should be treated as pending unless verified in a dev build/native build.
- LAN requires phone and dev machine on the same network; tunnel is better when LAN discovery is unreliable.

## Option B — Expo Web Preview

Use this if browser-based driver QA is enough for History/Transfer UI and Supabase RPC behavior.

### Start Locally

```bash
cd apps/driver-mobile
npm install
npm run web
```

Expected result:

- `/` loads the Driver Mobile app, not the root Tabarak Hub SPA.
- Login screen shows Driver Mobile copy.
- Bundle/source contains Driver Mobile strings such as `Open order details`, `Internal transfer`, and `tabarak-driver-mobile`.

### Optional Static Export Check

Only if web export is needed:

```bash
cd apps/driver-mobile
npx expo export --platform web --output-dir dist
```

Then serve `dist` locally and confirm:

- `dist/index.html` loads the Driver Mobile app.
- The built bundle contains Driver Mobile strings.
- Browser console has no runtime crash.

### Limits

- Web preview is useful for responsive layout, login, History, Transfer UI, and Supabase calls.
- Native-only behavior such as notification sound handling, push registration, and phone OS safe-area behavior still needs device validation.

## Option C — Separate Vercel Project for Driver Mobile Web

Use this if a shareable protected web preview is required.

### Vercel Project Settings

Configure a separate Vercel project with:

| Setting | Value |
| --- | --- |
| Project root | `apps/driver-mobile` |
| Install command | `npm install` |
| Build command | `npx expo export --platform web --output-dir dist` |
| Output directory | `dist` |

### Environment Variables

Configure names only; never commit values:

```text
EXPO_PUBLIC_SUPABASE_URL
EXPO_PUBLIC_SUPABASE_ANON_KEY
```

### Verification

After preview deploy:

- Public/protected preview should serve Driver Mobile HTML, not root Tabarak Hub HTML.
- Preview `/` should show Driver Mobile Login or the authenticated Driver workspace.
- Bundle scan should find Driver Mobile strings:
  - `Open order details`
  - `Internal transfer`
  - `tabarak-driver-mobile`
- Candidate root Hub strings should not be the primary served app shell.
- Authenticated QA should validate History and Transfer behavior before promotion.

### Limits

- This is still a web runtime, not native mobile.
- Vercel deployment protection may require `vercel curl`, an operator browser session, or an approved automation bypass token. Do not store bypass tokens.
- A separate project avoids accidentally serving the root SPA from the main Tabarak Hub Vercel project.

## Option D — Native Dev Build / APK

Use this when realistic driver-device testing is required.

### When Needed

- Validate custom notification sound behavior.
- Validate push token registration and native notification handling.
- Validate Android/iOS safe-area behavior on real driver devices.
- Validate location permission and duty-start branch-radius behavior under real OS permissions.

### Build Direction

Use an Expo dev build or APK only after explicit approval:

```bash
cd apps/driver-mobile
eas build --profile development --platform android
```

or for an installable QA artifact:

```bash
cd apps/driver-mobile
eas build --profile preview --platform android
```

### Limits

- Slower than Expo Go/tunnel.
- Requires EAS configuration and operator approval.
- Do not distribute APKs broadly until secrets/env handling and QA account controls are confirmed.

## Recommendation

Recommended next preview path:

```text
A) Expo Go / tunnel for immediate driver runtime QA
```

Reason:

- It validates the actual `apps/driver-mobile` Expo runtime fastest.
- It avoids creating or reconfiguring Vercel projects before confirming the app behavior.
- It supports real-phone layout and interaction checks.
- It keeps production promotion blocked until authenticated Driver History and Transfer QA passes.

Use Option C only if the team needs a stable shareable browser URL for Driver Mobile web QA.
Use Option D only if native notification sound, push, location, or APK-level behavior must be validated.

## QA Exit Criteria Before Production Promotion

- Driver app runtime is reachable and confirmed not to be the root Tabarak Hub SPA.
- Approved Driver session can log in without exposing credentials.
- History opens and shows eligible closed orders.
- Delivered orders appear immediately after completion.
- Delivered orders remain after reload if backend history supports them.
- Filters work: `All`, `Picked up`, `Delivered`, `Cancelled`, `Internal transfer`.
- History rows open the full read-only order detail sheet with lifecycle pathway timestamps.
- Internal Transfer setup opens and lists actual registered branches for `From` and `To`.
- Transfer create remains guarded by active duty and branch validation.
- No cross-driver or cross-branch leakage is observed.
- No production data is deleted.

