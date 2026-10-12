# ClockIn Implementation Plan

Version 1.0 · 11 Oct 2026

Build order: **Backend → Web admin → Mobile app (Android first, iOS after the pilot)**, first for Phase 1 (MVP + pilot), then again for Phase 2 (requests, leave, holidays, notifications).

Read first: [`docs/implementation/PRD.md`](docs/implementation/PRD.md) (what), [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) (how), [`docs/implementation/DESIGN_SYSTEM.md`](docs/implementation/DESIGN_SYSTEM.md) and [`docs/ui/SCREENS.md`](docs/ui/SCREENS.md) (look), [`docs/CODE_STRUCTURE.md`](docs/CODE_STRUCTURE.md) (where code goes).

## How to use this plan

- Each milestone has tasks (checkboxes) and a **Done when** list. A milestone is done only when every Done-when item is true and verified, not when the code compiles.
- Requirement codes (FR-M*, FR-W*) and screen IDs (M*, W*) point to the PRD and SCREENS.md.
- Estimates assume one full-time developer and are rough; use them for ordering, not promises.
- Why backend first: the web admin needs real data (employees, locations, schedules) before mobile can clock in, and the mobile app is the hardest to change once on phones. The API contract (OpenAPI) is frozen per milestone so the next client builds against something stable.

## Overview

| Stage | Milestones | Rough size |
|---|---|---|
| 0 · Foundation | F1 Monorepo & infra | 3–4 days |
| 1 · Backend (Phase 1) | B1 Core & auth · B2 Org data · B3 Attendance · B4 Review, override, reports · B5 Jobs & hardening | 4–5 weeks |
| 2 · Web admin (Phase 1) | W1 Shell & auth · W2 Org setup · W3 Employees · W4 Dashboard, review, override · W5 Recap, audit, settings, admin users | 4 weeks |
| 3 · Mobile Android (Phase 1) | M1 Foundation · M2 Auth & onboarding · M3 Home & clock in/out · M4 Offline · M5 History & profile · M6 Android release | 5 weeks |
| 4 · Pilot | D1 Production deployment · P1 Staging dry-run · P2 Pilot (30 people, 1 month) | 5–6 weeks |
| 5 · iOS | I1 iOS target & platform impls · I2 iOS QA & release | 2–3 weeks |
| 6 · Phase 2 | B6–B8 backend · W6–W7 web · M7–M8 mobile | 6–8 weeks |
| 7 · Phase 3 | Outline only | — |

---

## Stage 0 · Foundation

### F1 · Monorepo, tooling, local infra

- [ ] Init git repo, `.gitignore`, `.editorconfig`, `LICENSE` (if any), branch protection on `main`
- [x] Bun workspaces (`"workspaces"` in root `package.json`, `bun.lock` committed) + Turborepo (`apps/api`, `apps/admin`, `packages/api-schema`, `packages/eslint-config`, `packages/tsconfig`); `apps/mobile` lives in the repo but builds with Gradle
- [x] Shared ESLint (flat config) + Prettier + TypeScript strict configs
- [x] Docker for local dev per [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) §1, §4: `.dockerignore`, `bunfig.toml` (hoisted linker), `docker-compose.yml` with Postgres 16, Redis 7, RustFS S3 (+ bucket init; MinIO CE images discontinued), Mailpit
- [x] Empty `deploy/` folder skeleton: `Caddyfile`, `.env.prod.example`, `deploy.sh`, `backup.sh` (filled in D1)
- [x] `.env.example` for api and admin (keys from ARCHITECTURE §3)
- [x] GitHub Actions skeleton (`oven-sh/setup-bun` + Node 22): bun install --frozen-lockfile, lint, typecheck, test, build with Turborepo cache
- [x] Commit convention (Conventional Commits) + PR template per [`docs/CONTRIBUTION.md`](docs/CONTRIBUTION.md)

**Done when:** `bun install && docker compose up -d && bun run dev` starts empty API and admin apps; CI passes on an empty PR.

---

## Stage 1 · Backend, Phase 1 (`apps/api`)

### B1 · Core platform and auth

- [x] NestJS app: config (zod), pino logging with request ID, global ValidationPipe, problem+json exception filter with error `code`s, Helmet, health/ready endpoints
- [x] Prisma setup, first migration: `companies`, `users`, `employees` (minimal), `admin_users`, `sessions`, `password_resets`, `invitations`, `devices`, `device_change_requests`, `consent_versions`, `consent_acceptances`, `audit_logs`, `idempotency_keys`
- [x] Tenancy: `TenantContext` (AsyncLocalStorage) + Prisma extension injecting `companyId`; unit test that a tenant model query without context throws
- [x] Seed script: demo company (Sasana), Super Admin, HR Admin, a few employees, default consent text
- [x] Auth: argon2id, mobile sign-in (email or Employee ID) with device binding / `DEVICE_NOT_RECOGNIZED` + device change request, admin sign-in, refresh rotation with family reuse detection, sign-out, forgot/reset password (60 min single-use), change password (revokes other sessions), invitation accept via reset flow
- [x] Guards: `MobileAuthGuard`, `AdminAuthGuard`, `PermissionGuard` + `@RequirePermission()`, `ScopeService`
- [x] Rate limiting (Redis): sign-in per IP + per-account lockout in DB, forgot-password
- [x] `AuditService` (explicit `record(tx, …)` in the same transaction; no interceptor, per CODE_STRUCTURE rule 4)
- [x] Mail module (Nodemailer + MJML or simple templates): invite, reset password; Mailpit in dev
- [x] `GET /v1/app/config`, `GET /v1/me`, `POST /v1/me/consent`, `GET /v1/admin/me`
- [x] OpenAPI emit script → `packages/api-schema/openapi.json`; generate TS client; CI freshness check
- [x] e2e test harness with Testcontainers

**Done when:** e2e tests cover sign-in (both audiences), wrong password, lockout, device binding on first sign-in, unknown device → 409 + request created, refresh rotation and reuse revocation, reset password, change password; OpenAPI published.

### B2 · Organization data

- [ ] Departments + positions + team leads + manager (FR-W13); block delete with employees
- [ ] Locations (FR-W7): validation of lat/lng, radius, max accuracy, IANA tz; delete with `moveTo`
- [ ] Schedules (FR-W8): weekly / biweekly (week1/week2 days + anchor date), times, tolerances, cutoff, skip holidays, single default (partial unique index); delete with `moveTo`; `ScheduleService.resolve(employee, date)` + preview endpoint
- [ ] Employees (FR-W3/W4/W6): CRUD, filters, search, sort, pagination; allowed work modes; team lead / manager defaulting from department; annual leave entitlement stored; invitation send (email); deactivate (last working day + reason) / reactivate; delete (Super Admin, confirm by employee code); reset phone link; reset password; month stats
- [ ] Device change requests: list, approve (rebinds, revokes old sessions), decline
- [ ] CSV import (FR-W5): template download, validate (per-row errors with field + message, reference lookups by name/code), commit in a transaction, optional invitations
- [ ] Admin users (FR-W14): grant to employee, invite non-employee, change role/scope, remove access (revoke admin sessions); enforce Team Lead/Manager require employee; HR Admin cannot touch Super Admin
- [ ] Settings (FR-W12): typed `settings` jsonb with defaults from PRD §9.6 (retention 3/6/12/24, default 3), logo upload, Contact HR fields; consent versions
- [ ] Audit entries for every mutation above

**Done when:** e2e tests prove CRUD + validation for each resource, biweekly resolution across week boundaries and DST-free zones (WIB/WITA/WIT), scope isolation (Team Lead sees only team; department scope; all), cross-tenant 404, CSV import with mixed valid/invalid rows. Seed creates a realistic org (3 departments, 2 offices, 2 schedules, 30 employees).

### B3 · Attendance (clock in/out, offline sync)

- [ ] Migration: `attendance_events`, `attendance_days`, `attendance_overrides`
- [ ] Files module: presigned selfie upload (content-type + size bound), HEAD verify, presigned GET
- [ ] Geofence util (haversine) + tests
- [ ] `GET /v1/me/today` (server time, resolved schedule, day status, events, allowed modes, geofence, week strip)
- [ ] Clock-in / clock-out per ARCHITECTURE §7.2 with every error code; idempotency keys; early-leave confirmation; selfie-at-clock-out setting
- [ ] Flags: `WEAK_GPS`, `LOCATION_JUMP`, `NO_FACE`, `OFFLINE_DRIFT`, `OUTSIDE_GEOFENCE` (offline only)
- [ ] Offline sync endpoint per §7.3 (batch, ordered, per-item result, idempotent)
- [ ] `AttendanceDayService.recompute` (single writer) with status precedence
- [ ] History: month calendar + stats, day detail with selfie URLs
- [ ] Performance check: clock-in p95 < 1 s locally with seeded data (k6 or autocannon script)

**Done when:** unit tests for status computation (on time, late with tolerance, early leave, no clock-out, WFH marker) and offline time estimation; e2e tests for every rejection code, double clock-in, mock GPS with setting on/off, weak GPS allowed/blocked, sync replay returns same result, out-of-order sync.

### B4 · Review, override, dashboard, recap, audit

- [ ] Needs review (FR-W9): list pending, detail (selfie URL, office + point + accuracy, signals, last 7 days), accept / invalidate with required note → recompute day + audit
- [ ] Attendance override (FR-W19): PUT override with status/times/note; history keeps original events; audit
- [ ] Dashboard today (FR-W2): tiles, needs-review count, table with location/status filters, export (xlsx)
- [ ] Monthly recap (FR-W10): by employee and by department, attendance rate formula (PRD §9.1), under-90% flag, department filter; export xlsx (exceljs) and pdf (pdfmake); large exports via job
- [ ] Audit log query (FR-W11): filters actor/date/entity, pagination; DB role without UPDATE/DELETE on `audit_logs`

**Done when:** recap numbers match a hand-calculated fixture month (include late, absent, override to sick, invalid event, WFH); exports open in Excel and a PDF viewer; scope applied to dashboard, recap and exports.

### B5 · Jobs and backend hardening

- [ ] BullMQ setup + Bull Board (admin-only, behind auth) for visibility
- [ ] Jobs: `attendance.close-day`, `employees.apply-deactivation`, `retention.purge-selfies`, `retention.purge-locations`, `sessions.auto-sign-out`, `housekeeping` (ARCHITECTURE §8)
- [ ] Sentry (or equivalent) for API errors and job failures
- [ ] Security pass against ARCHITECTURE §12; dependency audit
- [ ] `apps/api/Dockerfile` (Bun build → Node 22 runtime, non-root, healthcheck) per DEPLOYMENT §2; `worker.ts` entry for jobs; `migrate` role runs `prisma migrate deploy`
- [ ] CI builds and pushes `clockin-api` image to GHCR (`:<sha>`, `:latest`) per DEPLOYMENT §6
- [ ] Staging host: `docker-compose.prod.yml` + Caddy, auto-deploy on main via `deploy.sh`
- [ ] Freeze `/v1` Phase 1 contract: tag `api-v1-phase1`, regenerate clients

**Done when:** jobs are idempotent (run twice → same result) with tests; `docker compose --profile full up --build` runs api + worker locally; staging API is reachable over HTTPS with seeded demo company, deployed only via image pull; OpenAPI tagged.

---

## Stage 2 · Web admin, Phase 1 (`apps/admin`)

### W1 · Shell, design system, auth (W01–W01f)

- [ ] Nuxt 4 + Nuxt UI + Tailwind v4; `main.css` and `app.config.ts` exactly as DESIGN_SYSTEM §5; Plus Jakarta Sans; Tabler icons bundled
- [ ] Nitro BFF: auth routes + `/api/[...]` proxy with cookie tokens, one-shot refresh, CSRF header (ARCHITECTURE §10)
- [ ] `useApi()` typed client from `packages/api-schema`; error `code` → i18n toast/inline error
- [ ] i18n setup (`en.json`), date/time formatting helpers (8 Oct 2026, 24-hour, WIB/WITA/WIT)
- [ ] Dashboard layout: sidebar (8 items, Needs review badge), account menu (W01e), change password modal (W01f)
- [ ] Pages: sign in + error state, forgot password + sent, set new password (also invitation accept)
- [ ] Permission-aware navigation and route guards from `/v1/admin/me`; phase-2 settings tabs hidden by feature flag
- [ ] Shared components: `AttendanceStatusBadge`, `StatTile`, `EmptyState`, `ConfirmDialog` (destructive), `PageHeader`

**Done when:** sign in/out, reset and change password work against staging API; tokens never appear in browser JS (verify in devtools); pages match PNGs at 1440 wide.

### W2 · Organization setup (W06, W07, W16d/f)

- [ ] `GeofenceMap` (MapLibre + OSM): pin drag, radius circle, paste "lat, lng" or Google Maps URL
- [ ] Office locations list/editor + delete with move-to (W06, W06a)
- [ ] Work hours list with `DayPills`; new/edit schedule with `WeekdayPicker`, rotation (W07a/b/d), delete with move-to (W07c), default badge
- [ ] Settings › Departments list + editor + add modal (W16d, W16f)

**Done when:** HR can set up offices, schedules and departments from zero on staging; validation errors show inline; deletes require move-to.

### W3 · Employees (W03, W03a, W03b, W04, W04a–c)

- [ ] Employees table with filters (department, office, schedule, work mode, device, status), search, server pagination, empty state
- [ ] Add employee form (sections per W04a, allowed work modes choice cards, invitation options)
- [ ] Employee detail: edit, linked phone card + reset + **new phone request approve/decline** (not designed: callout on the card), approvers card (Phase 2 placeholder), month stats, admin access (role + scope), reset password, deactivate modal, delete modal (type employee code)
- [ ] Import CSV wizard with `UStepper`, `UFileUpload`, `ImportReviewTable` with inline fixes

**Done when:** a 30-row CSV with 3 bad rows can be fixed inline and imported; invitations arrive in Mailpit; deactivate/reactivate/delete flows match designs.

### W4 · Dashboard, Needs review, attendance override (W02, W10, W10a)

- [ ] Dashboard: tiles, review banner, today table with location/status filters, export
- [ ] Needs review list + detail panel (selfie, map with accuracy circle, signals, last 7 days), accept / mark invalid with required note, empty state
- [ ] Attendance override slideover (FR-W19, not designed): opened from dashboard row, employee detail stats, and recap row; status + times + required note; "Edited by HR" marker

**Done when:** a flagged clock-in created from the API can be reviewed end-to-end and the dashboard/recap update; override shows in audit log.

### W5 · Recap, audit log, general settings, users & roles (W08, W08a, W11, W16, W16a, W16c)

- [ ] Monthly recap: month + department filters, summary tiles, By employee / By department tabs, progress bar (late color under 90%), export PDF/Excel
- [ ] Audit log table with actor/date filters
- [ ] Settings › General (W16) incl. Contact HR fields and 3-month selfie retention (PRD §9.6), logo upload, consent text editor (new version on save)
- [ ] Settings › Users & roles: list, inline role change, action menu, remove access confirm, invite employee / non-employee modals
- [ ] Playwright e2e: sign in, add employee, import CSV, review accept/invalid, override, recap export
- [ ] `apps/admin/Dockerfile` (Nuxt `.output`, runtime env config, healthcheck) per DEPLOYMENT §3; CI pushes `clockin-admin` image; added to staging compose

**Done when:** all Phase 1 W screens in SCREENS.md are implemented and checked against PNGs; Playwright suite green in CI; HR can configure a company fully from the web with no DB access.

---

## Stage 3 · Mobile app, Phase 1, **Android** (`apps/mobile`)

Android first; iOS follows in Stage 5. The project is Kotlin Multiplatform from day one with **only the Android target enabled**, MVVM per screen, phone features behind interfaces in `commonMain` (see [`docs/CODE_STRUCTURE.md`](docs/CODE_STRUCTURE.md) §4). Rule while building: if code doesn't need an Android API, it goes in `commonMain`. That keeps the iOS stage small.

### M1 · Foundation

- [ ] KMP project (`composeApp` module, Android target only; package `com.sasanadigital.clockin`), Compose Multiplatform, Koin, Ktor (OkHttp engine), kotlinx.serialization, SQLDelight, lifecycle ViewModel, Navigation Compose (type-safe routes); versions in `libs.versions.toml`
- [ ] MVVM skeleton: base folder layout per CODE_STRUCTURE §4.2, one sample feature (Splash) with Screen + ViewModel + UiState + Repository + tests
- [ ] Theme from DESIGN_SYSTEM §6: colors (light + dark), `StatusColors`, shapes, typography with Plus Jakarta Sans, Tabler `ImageVector`s for used icons
- [ ] Shared components: primary/secondary/danger buttons, text field, `StatusBadge`, bottom nav (3 items in Phase 1), bottom sheet, segmented control (with `@Preview`s)
- [ ] Network layer: base URL per build flavor (dev/staging/prod), `x-device-id`, server-time offset capture (`x-server-time`), auth plugin with refresh, problem+json → `ApiError`
- [ ] Platform interfaces in `core/platform` + Android impls: `SecureStorage` (Keystore-backed), `DeviceIdProvider`, `MonotonicClock` (`elapsedRealtime`), `ConnectivityMonitor`; bound in `platformModule`
- [ ] App config fetch + feature flags + force update (M01, M01a)
- [ ] CI: Android build (debug + release), commonTest + Android unit tests, ktlint/detekt, Android Lint

**Done when:** Splash → Update required works against staging `/v1/app/config` on an Android emulator and a real phone; CI green.

### M2 · Auth and onboarding (M02–M04, M02a–c)

- [ ] Login (email or Employee ID), inline errors, lockout message
- [ ] Device not recognized screen + Contact HR sheet (WhatsApp / phone / email intents)
- [ ] Forgot password + sent state
- [ ] Consent (versioned) → permissions explainer → Android permission prompts (fine location, camera; handle "don't ask again" → app settings)
- [ ] Biometric unlock offer + unlock on launch via `BiometricPrompt` (respect company setting)
- [ ] Session restore, sign out, auto sign-out handling (401 after revoke → login)

**Done when:** first sign-in on a new phone binds it; second phone gets Device not recognized and the request appears on web; HR approval lets the new phone in.

### M3 · Home, clock in/out (M05–M08)

- [ ] `LocationProvider` Android impl: FusedLocationProvider, accuracy, timeout, mock flag (`isMock` / `isFromMockProvider`)
- [ ] Home state machine (all M05 states as a sealed `HomeStatus`), ClockCard with ticking server time, shift countdown, `WorkModeSwitch`, `LocationPanel` mini-geofence (Compose canvas), week strip
- [ ] `SelfieCamera` + `FaceDetector` Android impls (CameraX + ML Kit face detection), selfie screen + no-face state, resize/compress, strip EXIF
- [ ] `ClockInUseCase`: presign → upload → clock-in with Idempotency-Key → confirmation (M08) for WFO and WFH (falls back to offline queue in M4)
- [ ] Clock-out flow with early leave dialog (M06), selfie per setting, summary screen
- [ ] Map every API error code to its screen/message

**Done when:** on real Android devices: inside/outside geofence, weak GPS (allowed and blocked), mock GPS blocked, permission denied recovery, WFH, early leave, double clock-in rejected; app open → clock-in saved under 10 s.

### M4 · Offline

- [ ] SQLDelight queue + selfie file storage, "Waiting to sync" state (Home offline)
- [ ] Offset + monotonic + boot ID capture (ARCHITECTURE §7.3)
- [ ] Sync on connectivity regain / app foreground with WorkManager, ordered, idempotent, retry with backoff
- [ ] Cached today/history for offline viewing

**Done when:** airplane-mode clock-in and clock-out sync correctly after reconnect, after app kill, and after reboot (flagged `OFFLINE_DRIFT` as designed); no duplicates on retry.

### M5 · History and profile (M09–M11c)

- [ ] History calendar with status colors + legend + month stats; day detail with selfies and locations
- [ ] Profile: work details, linked device, change password (rules from PRD §9.7), biometrics toggle, sign out confirm; Reminders row hidden (Phase 2)
- [ ] Dark mode follows system; font scaling check; content descriptions (TalkBack pass)

**Done when:** all Phase 1 M screens match PNGs at 390×844 (checked on a ~6.1" Android phone); accessibility checklist (DESIGN_SYSTEM §11) passes.

### M6 · Android release readiness

- [ ] Crash reporting (Sentry or Firebase Crashlytics), app version reported on requests
- [ ] Release signing (Play App Signing), R8/ProGuard rules for Ktor/serialization, internal testing track via Fastlane or Gradle Play Publisher
- [ ] Play Console: Data safety form, permission declarations (location foreground only, camera), privacy policy URL
- [ ] Device test matrix: low-end Android 8 and 10, Samsung (battery optimization), Xiaomi/Oppo (aggressive battery savers), recent Pixel

**Done when:** pilot users install from the Play internal testing track.

---

## Stage 4 · Pilot

### D1 · Production deployment setup (before P1)

- [ ] Provision VPS (2 vCPU / 4 GB, Ubuntu LTS), firewall (22/80/443 only), Docker + Compose plugin, `deploy` user
- [ ] DNS: `api.`, `admin.`, `files.` A records; Caddy auto-TLS working
- [ ] Fill `deploy/.env` from `.env.prod.example` with generated secrets; `docker login ghcr.io`
- [ ] `./deploy.sh <tag>` brings up migrate → api, worker, admin, postgres, redis, minio, caddy
- [ ] Create first Super Admin via `docker compose run --rm api node dist/cli.js create-admin`
- [ ] Backups: `backup.sh` cron (pg_dump + `mc mirror` to off-server bucket), restore drill done once
- [ ] GitHub Environment `production` with manual approval runs `deploy.sh` over SSH
- [ ] Rollback tested: deploy previous tag, app still works (migrations expand-only)

**Done when:** a fresh server goes from zero to running ClockIn by copying `deploy/`, filling `.env`, and running `./deploy.sh`; rollback and restore both verified.


### P1 · Staging dry-run (1 week)

- [ ] Import real employee list, configure real offices and schedules with HR
- [ ] 3–5 internal users clock in daily for a week; review and override flows exercised
- [ ] Confirm open PRD items: leave defaults, holidays (if needed manually via override), hosting, email provider
- [ ] Backups and restore tested; monitoring and alerts on

### P2 · Pilot (30 people, 1 month)

- [ ] Production deploy, onboarding session and short guide for employees and HR
- [ ] Weekly check of PRD §3 metrics (time to clock in, adoption, review completion, failed saves)
- [ ] Feedback triage → bugfix releases; decide Phase 2 priorities

**Exit criteria:** > 95% adoption, < 0.5% failed saves, HR produces month recap in < 30 min.

---

## Stage 5 · iOS app (after the Android pilot is stable)

Most code is already shared (`commonMain`). This stage adds the iOS target, iOS implementations of the platform interfaces, and the store release. Can run in parallel with Stage 6 backend work.

### I1 · iOS target and platform implementations

- [ ] Enable iOS targets (`iosArm64`, `iosSimulatorArm64`) in `composeApp`; Ktor Darwin engine; SQLDelight native driver
- [ ] `iosApp` Xcode host app with `ComposeUIViewController`, bundle id, app icons, launch screen
- [ ] `iosMain/platform` impls: `IosLocationProvider` (CoreLocation; `isMock` false → server-side flags), `IosSelfieCamera` + `IosFaceDetector` (AVFoundation + Vision), `IosSecureStorage` (Keychain, survives reinstall), `IosBiometricPrompt` (LocalAuthentication), `MonotonicClock` (`systemUptime`), `ConnectivityMonitor` (NWPathMonitor); `actual val platformModule`
- [ ] Background sync best-effort via BGTaskScheduler + sync on foreground
- [ ] Fix any shared-code assumptions found (file paths, date/time APIs, fonts)
- [ ] CI: iOS framework build + `iosSimulatorArm64Test` on a macOS runner

### I2 · iOS QA and release

- [ ] Full Phase 1 (and any shipped Phase 2) flows on real iPhones: iOS 15 device + latest iOS
- [ ] Usage strings (location when-in-use, camera, Face ID), privacy manifest, App Store privacy labels
- [ ] Signing, TestFlight via Fastlane, App Store review submission

**Done when:** iPhone users can do everything Android users can; fake-GPS on iOS lands in Needs review via server flags (PRD §10).

---

## Stage 6 · Phase 2 (same order: backend → web → mobile)

### B6 · Leave types, holidays, balances

- [ ] Tables per ARCHITECTURE §5.2; leave ledger as source of truth
- [ ] Leave types CRUD, special leave events (defaults from PRD §9.4), eligibility
- [ ] Balances: entitlement, proration, 12-month eligibility, carry-over + expiry, collective leave deduction, refunds when holidays added
- [ ] Holidays CRUD + national import (verified dataset) + schedule resolution integration
- [ ] Jobs: year rollover, carry expiry + reminder

### B7 · Requests and approvals

- [ ] Requests (leave, sick with attachment, overtime, correction); validation (balance, overlaps, correction window); cancel
- [ ] Approval flows (default + per department), flow snapshot on submit, any order / in sequence, one decline closes, self-approval rule, backup routing when approver on leave, reminders after 1 work day
- [ ] On approval: write overrides / leave days, deduct balance, recompute attendance days
- [ ] Remove admin access → move pending approvals to backup
- [ ] Sick attachment visibility rules

### B8 · Notifications

- [ ] In-app notifications, FCM push (token registration), templates
- [ ] Clock-in/out reminders per employee settings and schedule
- [ ] Turn on `features.requests`, `features.notifications`, `features.holidays` per company

### W6 · Web Phase 2 settings (W16b, W16e, W16e·1, W16g, W16g·1)

- [ ] `ApprovalChainEditor` (drag order, add approver, rules), per type and department
- [ ] Leave types editor + special leave + add leave type form (not designed; reuse editor)
- [ ] Holidays table + add/edit modal + import national holidays dialog

### W7 · Web approvals (FR-W18)

- [ ] HR requests inbox + detail (reuse request detail component), approve/decline with note; employee detail approvers card live

### M7 · Mobile requests and approvals (M12–M15b)

Built in `commonMain` first (Android ships it; iOS gets it automatically if Stage 5 is done).


- [ ] Requests tab (My requests / To approve + badge), new request forms (leave + type picker + special event picker, sick + attachment upload, overtime, correction from day detail)
- [ ] Request detail with approval chain, cancel
- [ ] Approvals list, review request, decline sheet

### M8 · Mobile notifications and reminders (M16, M11a)

- [ ] FCM setup on Android (APNs added when iOS is live), push token registration, notification inbox, deep links
- [ ] Reminder settings screen

**Phase 2 done when:** a leave request flows Team Lead → Manager → HR on mobile and web, balance updates, attendance shows the leave, and notifications arrive at each step; holiday on an approved leave date refunds the balance.

---

## Stage 7 · Phase 3 (outline)

Complex shifts and per-date schedule assignment; multi-branch with per-branch access; server-side face match and pattern-based fraud detection; multi-geofence for field staff; payroll / fingerprint integrations; multi-tenant SaaS onboarding.

---

## Cross-cutting definition of done (every milestone)

- Code follows [`docs/CODE_STRUCTURE.md`](docs/CODE_STRUCTURE.md) (feature folders, layers, MVVM on mobile).
- Tests written and green in CI (unit + e2e where listed).
- OpenAPI regenerated and committed when the API changed; clients rebuilt.
- Every mutation audited (API) and every string in i18n (clients).
- Screens checked against PNG and HTML in `docs/ui/`.
- Docs updated when behavior differs from the PRD or architecture (see CONTRIBUTION.md).

## Risks to watch during build

| Risk | When | Mitigation |
|---|---|---|
| Pilot employees with iPhones can't clock in until Stage 5 | P1 | Count iPhone users before the pilot; options: pilot with Android users only, loaner Android phones, or HR override for them; pull Stage 5 earlier if many |
| iOS mock-GPS can't be detected | I1 | Rely on server flags (jump, accuracy) + review queue; set expectation with HR |
| Indoor GPS accuracy worse than 50 m | M3 / P1 | Measure at real offices in P1; tune radius/max accuracy per location |
| Android OEM battery killers delay sync | M4 | Foreground sync on app open; guidance screen; WorkManager constraints |
| Face detection false negatives in low light | M3 | Clear hint, retry, and allow `NO_FACE` flag path instead of hard block if HR prefers |
| Scope bugs leak data across departments | B2–B5 | Central `ScopeService` + e2e isolation tests on every admin list/report |
| Phase 1 lacks leave data | P2 | FR-W19 override; fast-follow Phase 2 |
