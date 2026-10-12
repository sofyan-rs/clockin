# ClockIn Architecture

Version 1.0 · 11 Oct 2026 · Companion to [`implementation/PRD.md`](implementation/PRD.md) v2.1

This doc says **how** ClockIn is built. The PRD says **what** and **why**. When they disagree, the PRD wins on behavior and this doc gets fixed.

---

## 1. System overview

```
┌──────────────────────┐        ┌─────────────────────────────┐
│ Mobile app (KMP)     │ HTTPS  │ API  (NestJS, apps/api)     │
│ Android (iOS later)  │──────▶ │  REST /v1, OpenAPI          │
│ Bearer tokens        │        │  Prisma ──▶ PostgreSQL 16   │
└──────────────────────┘        │  BullMQ ──▶ Redis 7         │
                                │  S3 SDK ──▶ MinIO / S3      │
┌──────────────────────┐        │  SMTP, FCM (Phase 2)        │
│ Browser              │        └──────────────▲──────────────┘
│  ▼                   │                       │ Bearer (server-side)
│ Web admin (Nuxt 4)   │  httpOnly cookies     │
│  Nitro BFF /api/** ──┼───────────────────────┘
└──────────────────────┘
  Selfies / attachments: client ──PUT presigned URL──▶ object storage (never through the API)
```

| Concern | Decision | Why |
|---|---|---|
| Package manager | Bun (workspaces, scripts, lockfile `bun.lock`) | Fast installs; one tool for install + scripts. Runtime stays Node 22 LTS for NestJS and Nuxt (Prisma, NestJS and BullMQ are best supported there); Bun runtime can be evaluated later |
| Monorepo | Bun workspaces + Turborepo | One place for API, web, schema; cached builds |
| API style | REST + JSON, versioned `/v1`, OpenAPI 3.1 generated from code | Typed clients for Nuxt and KMP from one spec |
| ORM | Prisma | Mature migrations, typed queries, good NestJS fit |
| Jobs | BullMQ on Redis (repeatable jobs) | Durable, retries, visible failures; also backs rate limiting |
| Auth | JWT access (15 min) + opaque rotating refresh (30 days) | Short blast radius, revocable sessions |
| Web auth transport | Nuxt Nitro BFF keeps tokens in httpOnly cookies | No tokens in browser JS, no CORS, simple CSRF story |
| Files | Presigned PUT/GET to S3-compatible storage | Keeps clock-in API fast (< 1 s), private bucket |
| Time | Server clock only, `timestamptz` UTC, IANA zones per location | PRD §9.1 |
| Multi-tenancy | `company_id` on every tenant table, enforced in a Prisma extension | Pilot is single-tenant, SaaS-ready |

---

## 2. Repository layout

Inside each app, folders are organized by feature with the same layers everywhere. Full conventions, examples and a "where do I put…" table: [`CODE_STRUCTURE.md`](CODE_STRUCTURE.md).

```
clockin/
├── apps/
│   ├── api/                 NestJS backend
│   │   ├── prisma/          schema.prisma, migrations/, seed.ts
│   │   ├── src/
│   │   │   ├── main.ts, app.module.ts
│   │   │   ├── common/      guards, interceptors, filters, pipes, tenancy, time utils
│   │   │   ├── config/      typed env (zod)
│   │   │   └── modules/     one folder per domain (see §4)
│   │   └── test/            e2e (Supertest + Testcontainers)
│   ├── admin/               Nuxt 4 web admin
│   │   ├── app/             pages/, components/, composables/, stores/, assets/css/main.css, app.config.ts
│   │   ├── server/          Nitro BFF: api/[...].ts proxy, auth routes
│   │   └── i18n/locales/    en.json (id.json later)
│   └── mobile/              Kotlin Multiplatform (Gradle, not a Bun workspace)
│       ├── composeApp/      commonMain (almost everything) / androidMain / iosMain (Stage 5)
│       └── iosApp/          Xcode host app (Stage 5)
├── packages/
│   ├── api-schema/          openapi.json (generated) + TS client (openapi-typescript + openapi-fetch)
│   ├── eslint-config/
│   └── tsconfig/
├── docs/                    PRD, design system, screens, this file
├── docker-compose.yml       local infra: postgres, redis, rustfs (S3), mailpit
├── docker-compose.prod.yml  full stack for servers (see DEPLOYMENT.md)
├── deploy/                  Caddyfile, .env.prod.example, deploy.sh, backup.sh
├── PLAN.md
└── turbo.json, package.json (workspaces), bun.lock
```

Tooling versions: Bun 1.2+ (package manager), Node 22 LTS (runtime), TypeScript 5.x strict, NestJS 11, Nuxt 4, Nuxt UI 3+, Prisma 6, PostgreSQL 16, Redis 7, Kotlin 2.x, Compose Multiplatform 1.8+, JDK 17+, Android Studio (Xcode 16+ only from Stage 5, iOS). Pin exact versions in lockfiles.

---

## 3. Environments and configuration

| Env | Purpose | Infra |
|---|---|---|
| local | Dev | `docker compose up` → Postgres, Redis, RustFS (S3), Mailpit; API on :3000, admin on :3001 |
| staging | QA, pilot dry-run, Play internal testing builds (TestFlight once iOS ships) | Same images as prod, seeded demo company |
| production | Pilot | One VPS running `docker-compose.prod.yml`: Caddy (auto-TLS) → `api`, `admin`; `worker`; Postgres, Redis, MinIO on the internal network; images from GHCR; daily off-server backups |

All server-side parts ship as two Docker images (`clockin-api`, also used for the worker and migrations, and `clockin-admin`). Full Dockerfiles, compose files, Caddy config, env template and deploy/rollback steps: [`DEPLOYMENT.md`](DEPLOYMENT.md).

API config is validated at boot with zod (`src/config`). Required keys:

```
DATABASE_URL, REDIS_URL
JWT_ACCESS_SECRET, JWT_ACCESS_TTL=15m, REFRESH_TTL_DAYS=30
DEVICE_ID_PEPPER
S3_ENDPOINT, S3_PUBLIC_ENDPOINT (host used in presigned URLs), S3_REGION, S3_BUCKET, S3_ACCESS_KEY, S3_SECRET_KEY, S3_FORCE_PATH_STYLE
SMTP_URL, MAIL_FROM
APP_PUBLIC_URL (admin), API_PUBLIC_URL
SENTRY_DSN (optional), FCM_CREDENTIALS (Phase 2)
```

Admin (Nuxt runtime config): `NUXT_API_BASE` (internal API URL), `NUXT_SESSION_SECRET`, `NUXT_PUBLIC_APP_NAME`.

---

## 4. Backend (apps/api)

### 4.1 Modules

| Module | Responsibility | Phase |
|---|---|---|
| `auth` | Sign in (mobile + admin), refresh, sign out, forgot/reset password, change password, device binding, sessions | 1 |
| `companies` | Company profile, settings (clock-in rules, privacy, mobile app), consent versions, app config endpoint | 1 |
| `employees` | CRUD, CSV import, invitations, deactivate/reactivate, delete, reset phone, device change requests | 1 |
| `departments` | Departments, positions, team leads, manager | 1 |
| `locations` | Offices, geofence params, time zone | 1 |
| `schedules` | Weekly / biweekly schedules, default schedule, schedule resolution for a date | 1 |
| `attendance` | Clock in/out, offline sync, flags, daily rollup, review, override, history | 1 |
| `reports` | Dashboard today, monthly recap, Excel/PDF export | 1 |
| `audit` | Append-only audit log + query | 1 |
| `admin-users` | Admin roles, scope, invitations of non-employees, remove access | 1 |
| `files` | Presigned upload/download, object lifecycle | 1 |
| `jobs` | BullMQ queues and processors (see §8) | 1 |
| `mail` | Templated emails (invite, reset password) | 1 |
| `requests` | Leave / sick / overtime / correction requests | 2 |
| `approvals` | Approval flows, steps, decisions, backup routing | 2 |
| `leave` | Leave types, special leave events, balances, carry-over | 2 |
| `holidays` | Holidays, national import | 2 |
| `notifications` | In-app inbox, push via FCM, reminders | 2 |

Each module: `*.controller.ts` (thin), `*.service.ts` (business logic), `dto/` (class-validator + `@nestjs/swagger` decorators), `*.spec.ts`. Cross-module calls go through exported services, never through another module's Prisma models directly where a service exists.

### 4.2 Cross-cutting

| Piece | Implementation |
|---|---|
| Tenancy | `TenantContext` (AsyncLocalStorage) set from the token's `cid` claim. Prisma client extension injects `companyId` into every `where`/`data` for tenant models; raw SQL must pass it explicitly |
| AuthN guards | `MobileAuthGuard` (aud=`mobile`, active employee, bound device header matches) and `AdminAuthGuard` (aud=`admin`, active admin user) |
| AuthZ | `@Roles(...)` + `@Permission('employees.write')` decorators checked by `PermissionGuard`; scope filtering via `ScopeService.employeeWhere(admin)` used by every admin list/report query |
| Validation | Global `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })` |
| Errors | RFC 7807 `application/problem+json` with stable `code` (e.g. `OUTSIDE_GEOFENCE`, `DEVICE_NOT_RECOGNIZED`, `ALREADY_CLOCKED_IN`). Clients map `code` to i18n strings |
| Idempotency | `Idempotency-Key` header required on clock-in/out and sync; stored per employee for 7 days |
| Rate limiting | `@nestjs/throttler` with Redis storage: sign-in 5/15 min per account + 20/min per IP; forgot-password 3/h per account |
| Audit | `AuditService.record(actor, action, entity, before, after, note)` called inside the same transaction as the change |
| Logging | pino JSON logs with request ID (`x-request-id`), no PII in logs (mask email, no coordinates) |
| OpenAPI | `@nestjs/swagger` → `bun run --filter api openapi:emit` writes `packages/api-schema/openapi.json`; CI fails if it is stale |
| Health | `GET /healthz` (liveness), `GET /readyz` (DB, Redis, S3) |

### 4.3 Roles and permissions

Permissions are code constants, roles map to permission sets (PRD §4.2 matrix). Scope:

```ts
type AdminScope =
  | { kind: 'team' }                         // employees whose teamLeadId = me (or managerId = me for Manager)
  | { kind: 'departments'; ids: string[] }
  | { kind: 'all' };
```

Mobile approver role (Phase 2) is computed per request from the approval flow, not from the admin role table.

---

## 5. Data model

Postgres, all ids `uuid` (v7), all timestamps `timestamptz`, soft data kept via status columns (not `deleted_at`) except where noted. Every table except `companies` has `company_id` (FK, indexed). Names below are logical; Prisma models use PascalCase.

### 5.1 Phase 1 tables

| Table | Key columns | Notes |
|---|---|---|
| `companies` | name, app_name, logo_key, default_tz, locale, week_start, date_format, contact_whatsapp, contact_phone, contact_email, settings `jsonb` | `settings` holds clock-in rules, privacy, mobile app rules (typed with zod) |
| `consent_versions` | version, body, created_by, created_at | Latest = current |
| `consent_acceptances` | employee_id, consent_version_id, accepted_at, device_id | |
| `users` | email (citext, unique per company), password_hash (argon2id), password_changed_at, status (`invited`/`active`/`locked`), failed_attempts, locked_until | One credential per person; links employee and/or admin |
| `employees` | user_id, employee_code (unique per company), full_name, phone, department_id, position_id, team_lead_id, manager_id, location_id, schedule_id, allow_wfo, allow_wfh, join_date, annual_leave_entitlement, status (`active`/`deactivated`), last_working_day, deactivation_reason | `team_lead_id`/`manager_id` default from department, overridable |
| `admin_users` | user_id, employee_id (nullable), role, scope_kind, scope_department_ids `uuid[]`, status | Team Lead/Manager require employee_id (check constraint) |
| `departments` | name, code, manager_id, is_default | |
| `department_team_leads` | department_id, employee_id | |
| `positions` | department_id, name | |
| `locations` | name, address, lat, lng, radius_m, max_accuracy_m, tz (IANA) | |
| `schedules` | name, pattern (`weekly`/`biweekly`/`custom`), week1_days `smallint[]` (1=Mon…7=Sun), week2_days, anchor_date, start_time, end_time, late_tolerance_min, early_leave_min, break_min, absent_cutoff (time), skip_holidays, is_default | One default per company (partial unique index) |
| `devices` | employee_id, device_id_hash, platform, model, os_version, app_version, push_token, bound_at, revoked_at | One active (revoked_at null) per employee (partial unique index) |
| `device_change_requests` | employee_id, device_id_hash, platform, model, status (`pending`/`approved`/`declined`), decided_by, decided_at | |
| `sessions` | user_id, audience (`mobile`/`admin`), device_id, refresh_hash, family_id, expires_at, revoked_at, last_used_at, ip, user_agent | Rotation + reuse detection by family |
| `password_resets` | user_id, token_hash, expires_at, used_at | |
| `invitations` | user_id, channel, token_hash, expires_at, accepted_at | Set-password link for new employees/admins |
| `attendance_events` | employee_id, kind (`in`/`out`), mode (`wfo`/`wfh`), server_time, device_time, captured_offline, clock_drift_s, lat, lng, accuracy_m, distance_m, location_id, is_mock, selfie_key, face_detected, device_id, app_version, flags `text[]`, review_status (`none`/`pending`/`accepted`/`invalid`), reviewed_by, reviewed_at, review_note, idempotency_key, attendance_date | Immutable facts except review columns. Unique (employee_id, attendance_date, kind) where review_status ≠ `invalid` |
| `attendance_days` | employee_id, date, schedule_snapshot `jsonb`, expected (bool), status, late_min, early_leave_min, worked_min, is_wfh, needs_review, in_event_id, out_event_id, override_id | Rollup used by Home, History, Dashboard, Recap. Unique (employee_id, date) |
| `attendance_overrides` | employee_id, date, status, in_time, out_time, note, created_by, source (`hr`/`correction_request`), request_id | FR-W19; latest wins |
| `audit_logs` | actor_user_id, actor_label, action, entity_type, entity_id, before `jsonb`, after `jsonb`, note, ip, created_at | No UPDATE/DELETE grants for the app role |
| `idempotency_keys` | employee_id, key, response `jsonb`, created_at | TTL 7 days via job |

### 5.2 Phase 2 tables

| Table | Key columns |
|---|---|
| `leave_types` | name, kind (`annual`/`special`/`maternity`/`paternity`/`unpaid`/`custom`), paid, deducts_balance, half_day_allowed, requires_attachment, eligibility `jsonb`, rules `jsonb`, active |
| `special_leave_events` | leave_type_id, name, days, proof_grace_days, take_within_days |
| `leave_balances` | employee_id, leave_type_id, year, entitled, carried_over, carry_expires_on, used, pending |
| `leave_ledger` | employee_id, leave_type_id, delta, reason (`grant`/`request`/`refund`/`expire`/`collective`), ref_id | Balance = sum(ledger); `leave_balances` is a cache |
| `holidays` | name, type (`public`/`collective`/`company`), start_date, end_date, location_ids `uuid[]` (empty = all), repeat_yearly |
| `requests` | employee_id, type (`leave`/`sick`/`overtime`/`correction`), start_date, end_date, half_day, leave_type_id, special_event_id, overtime_start/end, correction payload `jsonb`, reason, attachment_key, days_count, status (`pending`/`approved`/`declined`/`cancelled`), flow_snapshot `jsonb` |
| `approval_flows` | request_type, department_id (null = default), order (`any`/`sequence`), self_rule (`backup`/`skip`/`escalate`) |
| `approval_flow_steps` | flow_id, position, approver_kind (`team_lead`/`manager`/`all_hr`/`person`), person_id, backup_person_id |
| `approval_steps` | request_id, position, approver_employee_ids `uuid[]`, state (`waiting`/`active`/`approved`/`declined`/`skipped`), routed_from |
| `approval_decisions` | approval_step_id, approver_employee_id, decision, note, decided_at |
| `notifications` | recipient_employee_id, kind, title, body, data `jsonb`, read_at |
| `reminder_settings` | employee_id, clock_in_time, clock_out_time, enabled |

### 5.3 Indexes that matter

- `attendance_days (company_id, date)` and `(employee_id, date)` for dashboard and history.
- `attendance_events (company_id, review_status) WHERE review_status = 'pending'` for Needs review.
- `employees (company_id, status, department_id)`.
- `audit_logs (company_id, created_at DESC)`, `(company_id, actor_user_id, created_at DESC)`.

---

## 6. API

Base path `/v1`. JSON, camelCase. Lists use `?page=1&pageSize=25&sort=field:asc&q=` and return `{ items, page, pageSize, total }`. Dates `YYYY-MM-DD`, instants ISO-8601 UTC. Mobile routes are under `/v1/me` or neutral paths with `MobileAuthGuard`; web routes are under `/v1/admin` with `AdminAuthGuard`.

### 6.1 Phase 1 endpoints

**Auth & app**

| Method | Path | Who | Notes |
|---|---|---|---|
| GET | `/v1/app/config` | public | min app version, feature flags, company name/logo, contact HR, server time |
| POST | `/v1/auth/mobile/sign-in` | public | `{ login, password, device: { id, platform, model, osVersion, appVersion } }` → tokens, or 409 `DEVICE_NOT_RECOGNIZED` (creates device change request) |
| POST | `/v1/auth/admin/sign-in` | public | `{ email, password }` → tokens (called by BFF) |
| POST | `/v1/auth/refresh` | refresh token | Rotates; reuse of an old token revokes the family |
| POST | `/v1/auth/sign-out` | any | Revokes current session |
| POST | `/v1/auth/forgot-password` | public | Always 204 (no account enumeration) |
| POST | `/v1/auth/reset-password` | token | Also used to accept invitations |
| POST | `/v1/auth/change-password` | any | Revokes other sessions |

**Mobile (employee)**

| Method | Path | Notes |
|---|---|---|
| GET | `/v1/me` | Profile, work details, linked device, computed roles, consent status |
| POST | `/v1/me/consent` | Accept current consent version |
| GET | `/v1/me/today` | Server time, schedule for today, day status, events, allowed modes, office geofence (lat/lng/radius/maxAccuracy/tz), week strip |
| POST | `/v1/files/selfie-upload` | → `{ key, url, headers, expiresAt }` presigned PUT (JPEG ≤ 1 MB) |
| POST | `/v1/attendance/clock-in` | `Idempotency-Key`. `{ mode, lat, lng, accuracy, isMock, selfieKey, faceDetected, deviceTime }` → event + day + status |
| POST | `/v1/attendance/clock-out` | Same body + `confirmEarlyLeave` |
| POST | `/v1/attendance/sync` | Batch of offline events (§7.3), per-item result |
| GET | `/v1/me/history?month=2026-10` | Calendar days + month stats |
| GET | `/v1/me/history/{date}` | Day detail with presigned selfie URLs |

**Web admin**

| Area | Endpoints |
|---|---|
| Account | `GET /v1/admin/me` |
| Dashboard | `GET /v1/admin/dashboard/today?locationId=&status=`, `GET …/today/export` |
| Employees | `GET/POST /v1/admin/employees`, `GET/PATCH/DELETE /v1/admin/employees/{id}`, `POST …/{id}/deactivate`, `POST …/{id}/reactivate`, `POST …/{id}/reset-device`, `POST …/{id}/reset-password`, `POST …/{id}/invite`, `GET …/{id}/stats?month=` |
| Device requests | `GET /v1/admin/device-requests?status=pending`, `POST …/{id}/approve`, `POST …/{id}/decline` |
| Import | `GET /v1/admin/employees/import/template`, `POST …/import/validate` (CSV → row results), `POST …/import/commit` |
| Departments | `GET/POST /v1/admin/departments`, `GET/PATCH/DELETE …/{id}` (+ positions, team leads in body) |
| Locations | `GET/POST /v1/admin/locations`, `GET/PATCH …/{id}`, `DELETE …/{id}?moveTo=` |
| Schedules | `GET/POST /v1/admin/schedules`, `GET/PATCH …/{id}`, `DELETE …/{id}?moveTo=`, `GET …/{id}/preview?from=&to=` |
| Review | `GET /v1/admin/review?status=pending`, `GET …/{eventId}` (selfie URL, map data, signals, last 7 days), `POST …/{eventId}/accept`, `POST …/{eventId}/invalidate` |
| Attendance | `GET /v1/admin/attendance?employeeId=&from=&to=`, `PUT /v1/admin/attendance/{employeeId}/{date}/override` |
| Reports | `GET /v1/admin/reports/monthly?month=&departmentId=&view=employee|department`, `GET …/monthly/export?format=xlsx|pdf` |
| Audit | `GET /v1/admin/audit-logs?actorId=&from=&to=&entityType=` |
| Settings | `GET/PATCH /v1/admin/settings`, `POST /v1/admin/settings/logo-upload`, `GET/POST /v1/admin/consent-versions` |
| Admin users | `GET /v1/admin/admin-users`, `POST …` (grant to employee or invite non-employee), `PATCH …/{id}` (role/scope), `DELETE …/{id}` (remove access, revoke sessions, move pending approvals) |

### 6.2 Phase 2 endpoints (outline)

`/v1/me/requests` (list, create, cancel), `/v1/me/approvals` (pending, decide), `/v1/me/leave-balances`, `/v1/files/attachment-upload`, `/v1/me/notifications` (list, mark read), `/v1/me/reminders`, `/v1/me/push-token`; admin: `/v1/admin/approval-flows`, `/v1/admin/leave-types`, `/v1/admin/special-leave-events`, `/v1/admin/holidays` (+ `/import-national`), `/v1/admin/requests` (HR approvals on web).

---

## 7. Attendance engine

### 7.1 Schedule resolution

`ScheduleService.resolve(employee, date)` returns `{ expected, start, end, lateTolerance, earlyLeave, cutoff, reason }`:

1. Employee inactive or before join date / after last working day → not expected.
2. Holiday (Phase 2) for the employee's location and schedule `skip_holidays` → not expected, `reason=HOLIDAY`.
3. Approved leave / override for that date → not expected, `reason=LEAVE|SICK|…`.
4. Weekday (ISO 1–7) in `week1_days` (weekly) or in week1/week2 by `floor((date − anchor_date) / 7) mod 2` (biweekly) → expected with times converted from location tz to UTC.

### 7.2 Clock-in validation (online)

```
1. Idempotency-Key seen?            → return stored response
2. Device header matches bound device → else 403 DEVICE_NOT_RECOGNIZED
3. Consent accepted (current version) → else 403 CONSENT_REQUIRED
4. Mode allowed for employee          → else 422 MODE_NOT_ALLOWED
5. Already clocked in today           → 409 ALREADY_CLOCKED_IN
6. Selfie object exists (HEAD), image/jpeg, ≤ 1 MB → else 422 SELFIE_MISSING
7. isMock && settings.blockFakeGps    → 422 MOCK_LOCATION
8. WFO: distance = haversine(office, point)
     distance > radius                → 422 OUTSIDE_GEOFENCE { distanceM }
     accuracy > maxAccuracy           → allowWeakGps ? flag WEAK_GPS : 422 WEAK_GPS
9. Flags: LOCATION_JUMP (speed from previous event > 150 km/h),
          NO_FACE (faceDetected=false), DEVICE_MISMATCH (should not happen online)
10. Insert event (server_time = now()), set review_status = pending if flags ≠ ∅
11. Recompute attendance_day (status On time / Late x min), audit nothing (facts are the audit)
12. Return { event, day, serverTime }
```

Clock-out follows the same steps; it requires a clock-in today (else 409 `NOT_CLOCKED_IN`), requires a selfie only if `selfieAtClockOut`, and returns 422 `EARLY_LEAVE_CONFIRM_REQUIRED` when before `end − earlyLeave` and `confirmEarlyLeave` is false.

### 7.3 Offline capture and sync

The device cannot be trusted for time, so the app keeps a **server offset**:

- Every API response carries `Date` / `x-server-time`. The app stores `offset = serverTime − deviceWallClock` and `elapsedAtSync = monotonicClock()` (Android `elapsedRealtime`, iOS `ProcessInfo.systemUptime`).
- Offline capture stores `{ clientId (uuid), kind, mode, lat, lng, accuracy, isMock, selfieFile, faceDetected, deviceTime, estServerTime, monotonicAt, bootId }` in SQLDelight. `estServerTime = deviceTime + offset`.
- If the phone rebooted since the last sync (different `bootId`) the estimate is marked `untrusted`.
- On reconnect the queue uploads selfies (presigned) then calls `/v1/attendance/sync` in capture order with `Idempotency-Key = clientId`.
- Server sets `server_time = estServerTime` when trusted and plausible (not in the future, not older than 72 h, after the previous event), records `clock_drift_s = |deviceTime − estServerTime|` plus the gap between `estServerTime` and arrival, sets `captured_offline = true`, and flags `OFFLINE_DRIFT` when the drift exceeds the company threshold or the estimate is untrusted. Geofence failures on offline events are **flagged** (`OUTSIDE_GEOFENCE`), not rejected, because the event already happened.

### 7.4 Daily rollup

`AttendanceDayService.recompute(employeeId, date)` is the only writer of `attendance_days`. It runs after every event, review decision, override, schedule change for that date, and from jobs. Status precedence: override → approved leave/sick → holiday → events (On time / Late / Early leave / No clock-out) → Absent (only after cutoff) → pending (before cutoff, no events). `needs_review` = any event with `review_status = pending`. Invalid events are ignored.

---

## 8. Background jobs (BullMQ)

Jobs run in a separate **worker** process (`apps/api/src/worker.ts`, same image as the API, started with `node dist/worker.js`) so heavy exports and nightly jobs never slow down clock-in requests. Run one worker replica.

| Job | Schedule | Phase |
|---|---|---|
| `attendance.close-day` | Every 15 min: for each location whose local time passed a schedule's cutoff, mark Absent / No clock-out for that date | 1 |
| `employees.apply-deactivation` | Hourly: after last working day → revoke sessions, unbind device, set status | 1 |
| `retention.purge-selfies` | Daily 02:00: delete objects + null `selfie_key` older than retention | 1 |
| `retention.purge-locations` | Daily 02:30: null lat/lng/accuracy older than retention | 1 |
| `sessions.auto-sign-out` | Daily: revoke mobile sessions unused for N days | 1 |
| `housekeeping` | Daily: expired idempotency keys, resets, invitations; orphaned uploads (no event after 24 h) | 1 |
| `reports.export` | On demand: large exports, emailed link when > 10 s | 1 |
| `approvals.reminders` / `approvals.route-backup` | Hourly | 2 |
| `notifications.clock-reminders` | Every minute, per reminder settings and schedule | 2 |
| `leave.year-rollover` / `leave.carry-expiry` | 1 Jan / 31 Mar (+ reminder 2 weeks before) | 2 |

All jobs are idempotent and keyed by `(company, date)` where applicable. Failures alert via Sentry.

---

## 9. Files and storage

- Bucket is private. Keys: `{companyId}/selfies/{yyyy}/{mm}/{employeeId}/{uuid}.jpg`, `{companyId}/attachments/{requestId}/{uuid}.{ext}`, `{companyId}/branding/logo.{ext}`.
- Upload: client asks API for a presigned PUT (5 min TTL, fixed content-type and max length via signed headers), uploads directly, then references the key.
- Download: API returns presigned GET (5 min TTL) only after an authorization check (owner, scoped admin, approver for attachments).
- Selfie client-side: front camera, max 720 px long edge, JPEG q≈80, EXIF location stripped.

---

## 10. Web admin (apps/admin)

| Concern | Approach |
|---|---|
| Rendering | SSR off for authenticated pages (`ssr: false` route rules for app shell), SSR for auth pages is optional; it is an internal tool |
| BFF | `server/api/auth/*` (sign-in, sign-out, refresh) store `ci_at` (access, 15 min) and `ci_rt` (refresh, path `/api/auth`) as httpOnly, Secure, SameSite=Lax cookies. `server/api/[...].ts` proxies to `NUXT_API_BASE/v1/admin/**` adding `Authorization`, refreshing once on 401 |
| CSRF | SameSite=Lax + require `X-Requested-With: clockin` on mutating BFF calls |
| API client | `openapi-fetch` typed from `packages/api-schema`, wrapped in `useApi()` composable; data fetching via `useAsyncData` / Pinia Colada or plain Pinia stores |
| UI | Nuxt UI per `DESIGN_SYSTEM.md §5, §7`; custom components in `app/components/` (§8 of the design system) |
| Layout | `layouts/dashboard.vue` with `UDashboardGroup` + sidebar (8 nav items, Needs review count badge) |
| Auth middleware | `middleware/auth.global.ts` redirects to `/login`; permission-aware nav and page guards from `/v1/admin/me` |
| Forms | `UForm` + zod schemas shared in `app/schemas` |
| Tables | `UTable` with server-side pagination/sort/filter via query params (shareable URLs) |
| Maps | MapLibre GL (`GeofenceMap.vue`) with OSM raster tiles |
| i18n | `@nuxtjs/i18n`, `en` only, keys like `employees.add.title`; API error `code` → `errors.<CODE>` |
| Tests | Vitest + `@nuxt/test-utils` for components/composables, Playwright for key flows |

---

## 11. Mobile (apps/mobile)

**Rollout:** Android first (Phase 1 + pilot), iOS after the pilot. The project is Kotlin Multiplatform from day one but only the Android target is enabled until Stage 5, so UI, ViewModels and data code are already shared when iOS starts.

**Pattern:** MVVM with one-way data flow. View = Compose screen (stateless, draws `UiState`), ViewModel = `StateFlow<UiState>` + one function per user action + one-off effects, Model = repositories / API / database / use cases. Details and examples in [`CODE_STRUCTURE.md`](CODE_STRUCTURE.md) §4.

| Layer | Shared (commonMain) | Android (androidMain) | iOS (iosMain, Stage 5) |
|---|---|---|---|
| View | Compose Multiplatform screens, theme from design tokens, Navigation Compose (type-safe routes) | `MainActivity` host | `ComposeUIViewController` in `iosApp` |
| ViewModel | `androidx.lifecycle` KMP ViewModels; Home uses a sealed `HomeStatus` (`Locating`, `InsideGeofence`, `OutsideGeofence`, `WeakGps`, `MockGpsBlocked`, `PermissionDenied`, `Offline`, `NoShift`, `OnLeave`, `ClockedIn`, `ClockedOut`) | | |
| Model: domain | Use cases for multi-step flows (ClockIn, ClockOut, SyncQueue); geofence math; status mapping | | |
| Model: data | Ktor client (auth plugin with refresh, `x-device-id`, server-time capture), kotlinx.serialization DTOs, repositories, SQLDelight (offline queue, cached today/history) | OkHttp engine, Android SQLite driver | Darwin engine, native driver |
| Model: platform | **Interfaces** in `core/platform`: `LocationProvider` (fix + accuracy + isMock), `SelfieCamera`, `FaceDetector`, `SecureStorage`, `BiometricPrompt`, `DeviceIdProvider`, `MonotonicClock`, `ConnectivityMonitor`, `PushTokenProvider` (P2) | FusedLocation, CameraX + ML Kit, Keystore-backed encrypted storage, BiometricPrompt, `elapsedRealtime`, ConnectivityManager, FCM | CoreLocation, AVFoundation + Vision, Keychain, LocalAuthentication, `systemUptime`, NWPathMonitor, APNs via FCM |
| DI | Koin; the only `expect/actual` is `platformModule`, which binds the platform implementations | `actual val platformModule` | `actual val platformModule` |
| Background sync | Triggered on connectivity regain + app foreground | WorkManager | BGTaskScheduler (best-effort) |

Device ID: UUID generated on first launch and kept in secure storage. Android: Keystore-backed storage (reset on reinstall → new phone request). iOS: Keychain (survives reinstall). Sent as `x-device-id`; server stores `sha256(deviceId + DEVICE_ID_PEPPER)`.

Minimum: Android 8 (API 26), target the latest Play-required API level. iOS 15+ when the iOS target ships.

---

## 12. Security checklist

- argon2id password hashing; constant-time comparisons; generic sign-in errors.
- Refresh tokens: 256-bit random, stored as SHA-256, rotated on every use, family revoked on reuse.
- Access JWT claims: `sub` (user id), `cid`, `aud`, `sid` (session), `eid` / `aid` (employee / admin ids). Validate `sid` not revoked on sensitive admin actions.
- Every admin query passes through scope filtering; e2e tests assert cross-scope and cross-tenant access returns 404.
- Presigned URLs short-lived; no public bucket.
- Helmet headers on API; strict CSP on admin.
- Audit log table: app DB role has INSERT/SELECT only.
- Secrets only via env / secret manager; never in repo.

---

## 13. Testing strategy

| Layer | Tooling | Must cover |
|---|---|---|
| API unit | Jest (or Vitest) | Schedule resolution, status computation, geofence math, offline time estimation, approval routing (P2), leave balance math (P2) |
| API e2e | Supertest + Testcontainers (Postgres, Redis, MinIO) | Auth + device binding, clock-in/out happy and every rejection code, sync idempotency, scope isolation, audit entries |
| Web | Vitest + Playwright | Sign in, add employee, import CSV, review accept/invalid, recap export |
| Mobile | kotlin.test in commonTest, Compose UI tests, manual device matrix | Home state machine, offline queue, token refresh; real devices for GPS/camera/mock detection |
| Contract | OpenAPI diff in CI | No breaking changes without a version note |

---

## 14. CI/CD

- GitHub Actions: `lint → typecheck → test → build` per affected package (Turborepo filters); `openapi.json` freshness check; Prisma migration check (`prisma migrate diff`).
- Images: `apps/api` and `apps/admin` Dockerfiles (Bun build stage → `node:22-slim` runtime), pushed to GHCR on main; staging auto-deploy via `deploy.sh`, production behind manual approval (DEPLOYMENT §6).
- Mobile: Gradle build + tests + ktlint/detekt/Android Lint on CI; Play internal testing track via Fastlane (manual trigger). iOS TestFlight added in Stage 5 (macOS runner).
- DB migrations run as a separate release step before the new API starts.
