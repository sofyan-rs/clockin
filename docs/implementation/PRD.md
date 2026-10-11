# ClockIn PRD: Office Attendance App

Version 2.1 · 11 Oct 2026 · Owner: Sofyan (Sasana Digital)

This is the product requirements document for ClockIn. It supersedes v2.0 (Indonesian) and is the version engineering builds from.

| Related doc | Purpose |
|---|---|
| [`../ARCHITECTURE.md`](../ARCHITECTURE.md) | Technical design: stack, modules, data model, API, jobs |
| [`DESIGN_SYSTEM.md`](DESIGN_SYSTEM.md) | Tokens, components, status vocabulary |
| [`../ui/SCREENS.md`](../ui/SCREENS.md) | Every designed screen (PNG + HTML), route / destination, phase |
| [`../../PLAN.md`](../../PLAN.md) | Implementation plan: backend → web admin → mobile |

**Changes in v2.1 (from v2.0)**

| Topic | v2.0 | v2.1 |
|---|---|---|
| Language of this doc | Indonesian | English (all project docs now in one language) |
| Paths | `clockin-ui/…` | `docs/ui/…` (actual repo location) |
| Phase 1 attendance fixes | None (corrections were Phase 2 only) | **FR-W19 Attendance override** for HR in Phase 1, so leave, sick and forgotten clock-outs can be recorded during the pilot |
| Selfie retention | "3 months, design shows 6/12/24" | Options **3 / 6 / 12 / 24 months, default 3** (design to be updated) |
| Mobile in Phase 1 | Bottom nav shows Requests, bell, Reminders | Phase 2 entry points are **hidden by feature flag** in Phase 1 (see §5.1) |
| Offline time | "server time at sync corrected by drift" | Exact algorithm defined (§9.1, ARCHITECTURE §7.3) |
| Device binding | "device ID hashed" | App-generated install ID, hashed server-side (§10) |
| Mobile rollout | Android + iOS together | **Android first** (Phase 1 pilot), iOS right after the pilot from the same shared Kotlin code |
| Open questions | 5 open | Defaults chosen for maps and multi-geofence; remaining questions in §15 |

**Changes in v2.0 (from v1), kept for history:** stack moved from Hono + SvelteKit to NestJS + Nuxt 4 + Nuxt UI (mobile stays Kotlin Multiplatform); UI copy in English with i18n; WFH moved to Phase 1 and set per employee; selfie at clock-in **and** clock-out; approval flows per request type and department with multiple approvers; employee and admin accounts separated but share one password.

---

## 1. Product summary

ClockIn is an office attendance system with two clients and one backend:

- **Mobile app** for employees and approvers (Team Lead, Manager, HR): clock in/out with GPS + selfie, history, requests, approvals.
- **Web admin** for HR: employees, schedules, locations, rules, approvals, recap, anomaly review.

| Aspect | Detail |
|---|---|
| Product name | ClockIn (one word, capital C and I) |
| Platforms | Mobile: Kotlin Multiplatform + Compose Multiplatform, **Android first**, iOS after the Android pilot (same shared code). Web admin: Nuxt 4 + Nuxt UI |
| Backend | NestJS (TypeScript) + PostgreSQL + S3-compatible object storage (MinIO in dev) |
| Users | Employees, approvers (Team Lead / Manager / HR), web admins (HR, HR Admin, Super Admin, Manager, Team Lead) |
| Core value | Clock in under 10 seconds, attendance data that is hard to fake, automatic recap |
| Pilot | 1 company, ~30 employees (office, WFH, some field staff and shifts). Schema is multi-tenant ready for SaaS later |

## 2. Problem and solution

| Problem | Impact | ClockIn solution |
|---|---|---|
| Manual month-end recap | HR spends days, miscounts | Automatic recap per employee and per department, Excel/PDF export |
| Buddy punching and fake locations | Data can't be trusted | Geofence, selfie, one account per phone, fake-GPS detection, review queue |
| Leave, permission and overtime via chat | Slow, untraceable approvals | In-app requests and approval flows |
| Employees don't know their status | Disputes over late/absent | Transparent personal history, notifications |

## 3. Goals and metrics

| Goal | Metric | Target |
|---|---|---|
| Fast clock-in | App open → clock-in saved | < 10 s |
| Adoption | Active employees clocking in via the app | > 95% within 1 pilot month |
| Accurate data | Flagged clock-ins that get reviewed | 100% |
| HR time saved | Time to prepare monthly recap | < 30 min |
| Reliability | Clock-ins that fail to save | < 0.5% |

**Non-goals:** full payroll (only export supporting data), AI shift scheduling, performance management, kiosk/tablet app.

## 4. Roles and access

### 4.1 Mobile roles (derived from employee data)

| Role | Derived from | Can |
|---|---|---|
| Staff | Default | Clock in/out, history, requests, profile |
| Team Lead | Set as a team lead of a department | Above + **To approve** tab for their team |
| Manager | Set as a department's manager | Above for their department |
| HR | Employee who also has web admin role HR, HR Admin or Super Admin | Approves according to approval flows |

Mobile roles are computed, not stored: they come from department assignments and admin access. Approval rights in Phase 1 have no effect (requests are Phase 2).

### 4.2 Web admin roles (Settings › Users & roles)

| Role | Access |
|---|---|
| Super Admin | Everything, including billing and data deletion (Delete employee) |
| HR Admin | Employees, locations, schedules, settings, all reports |
| HR | Review clock-ins, approve requests, view reports, attendance override |
| Manager | Approve requests and view attendance of their department |
| Team Lead | Approve requests and view attendance of their team |

Every admin user has a **scope** ("Can see"): `team` (only their team), `departments` (selected departments), or `all`. Scope filters every list, report and export on the web.

Permission matrix (Phase 1 web features; ✓ = allowed within scope):

| Capability | Super Admin | HR Admin | HR | Manager | Team Lead |
|---|---|---|---|---|---|
| Dashboard, monthly recap, export | ✓ | ✓ | ✓ | ✓ | ✓ |
| Needs review: accept / mark invalid | ✓ | ✓ | ✓ | | |
| Attendance override (FR-W19) | ✓ | ✓ | ✓ | | |
| Employees: view | ✓ | ✓ | ✓ | ✓ | ✓ |
| Employees: create / edit / import / deactivate / reset phone / reset password | ✓ | ✓ | | | |
| Employees: delete | ✓ | | | | |
| Locations, work hours, departments, general settings | ✓ | ✓ | | | |
| Users & roles (grant / change / remove admin access) | ✓ | ✓ ¹ | | | |
| Audit log | ✓ | ✓ | | | |

¹ HR Admin can't grant or remove Super Admin.

### 4.3 Employees vs admin users

- An **employee** is someone who clocks in. An **admin user** is someone who can sign in to the web admin.
- An admin user is **either an employee** (access granted from the employee record) **or a non-employee** (e.g. IT or owner; invited by email, not listed in Employees, never clocks in, not counted in recap).
- An admin who is also an employee uses the **same work email and password** on app and web. Admin access can be removed without affecting employment.
- Team Lead and Manager web roles must be linked to an employee.
- Non-employee admins sign in to the web only. They can't sign in to the mobile app.

## 5. Scope by phase

| Feature | Phase 1 (MVP) | Phase 2 | Phase 3 |
|---|---|---|---|
| Mobile platform | Android | iOS (right after pilot, before Phase 2 features) | |
| Login, forgot password, device binding, consent, permissions | ✓ | | |
| Clock in/out WFO (geofence + selfie) and **WFH** | ✓ | | |
| Basic offline mode + mock GPS detection (Android) | ✓ | | |
| History, day detail, profile, change password, biometrics | ✓ | | |
| Web: dashboard, employees (add, CSV import, deactivate, delete), departments | ✓ | | |
| Web: office locations, work hours (weekly + 2-week rotation) | ✓ | | |
| Web: needs review, monthly recap (by employee and department), audit log | ✓ | | |
| Web: general settings, admin users & roles, admin account | ✓ | | |
| Web: attendance override (HR sets/corrects a day) | ✓ | | |
| Requests: leave, sick, overtime, correction + approval flows | | ✓ | |
| Leave types, special leave, holiday calendar | | ✓ | |
| Push notifications + clock in/out reminders | | ✓ | |
| Complex shifts and per-date schedule assignment | | | ✓ |
| Multi-branch with per-branch access | | | ✓ |
| Advanced anti-fraud (patterns, server-side face match) | | | ✓ |
| Payroll / fingerprint integration | | | ✓ |

UI design covers Phase 1 and 2.

### 5.1 Phase gating on clients

Phase 2 entry points exist in the designs but must be **hidden in Phase 1** behind a server-driven feature flag (`features.requests`, `features.notifications`, `features.holidays`):

| Client | Hidden in Phase 1 |
|---|---|
| Mobile | Requests tab (bottom nav shows Home, History, Profile), notification bell, Reminders row in Profile, "Request correction" link in Day detail, Leave/Holiday Home states (only when there is no source data) |
| Web | Settings tabs Approval flows, Leave types, Holidays; approvers card on Employee detail shows "Available in Phase 2" or is hidden |

---

## 6. Functional requirements: mobile

| Code | Requirement | Phase |
|---|---|---|
| FR-M1 | Sign in with work email **or** Employee ID + password. Session = short-lived access token + rotating refresh token | 1 |
| FR-M2 | Unlock with biometrics after first sign-in (HR can disable globally) | 1 |
| FR-M3 | One account bound to one phone. Signing in on another phone shows "Device not recognized" and creates a **new phone request** that HR approves | 1 |
| FR-M4 | Data consent (selfie, location) at first sign-in and whenever the consent version changes; explanation screen before asking location and camera permission | 1 |
| FR-M5 | Minimum version check on launch; outdated versions see Update required | 1 |
| FR-M6 | Forgot password via email link; Contact HR sheet (WhatsApp, phone, email from company settings) | 1 |
| FR-M7 | Home: greeting, **server time**, today's shift, shift countdown, work-mode switch (Office/Home when both allowed), location panel, Clock in/out button, this-week strip | 1 |
| FR-M8 | WFO: clock-in valid when inside radius and GPS accuracy is good enough. States: locating, inside, outside (with distance), weak GPS, mock GPS blocked, permission denied, offline | 1 |
| FR-M9 | WFH: no geofence; location still recorded **only at clock-in/out**; selfie required | 1 |
| FR-M10 | Selfie from front camera with on-device face detection; gallery not allowed | 1 |
| FR-M11 | Confirmation: photo, server time, status (On time / Late x min), location, distance + accuracy | 1 |
| FR-M12 | Clock out with selfie (if enabled); before the early-leave threshold show Early leave warning and ask to confirm; summary with worked duration | 1 |
| FR-M13 | Offline: clock event goes to a local queue marked Offline and syncs automatically | 1 |
| FR-M14 | Special Home states: no shift today, on leave (Phase 2 data or HR override), already clocked out | 1 |
| FR-M15 | History: monthly calendar colored by status + month stats; day detail (times, selfies, location, notes, link to request correction in Phase 2) | 1 |
| FR-M16 | Profile: work details, linked phone, reminders (Phase 2), change password, biometrics, sign out (with confirmation) | 1 |
| FR-M17 | Requests: Leave (pick leave type + remaining balance), Sick (doctor's note attachment), Overtime, Correction. The form shows who will approve | 2 |
| FR-M18 | Request list (tabs My requests / To approve + count badge); detail with approval progress per approver; cancel while not all approvers have responded | 2 |
| FR-M19 | Approver: pending list (oldest first), detail (balance, department colleagues also on leave, other approvers), approve with optional note, decline with required note | 2 |
| FR-M20 | In-app + push notifications: clock reminders, request outcomes, approval requests | 2 |
| FR-M21 | Reminders: set clock-in and clock-out reminder times | 2 |
| FR-M22 | Special leave: employee picks the event (marriage, birth, bereavement, etc.) from the list configured on web | 2 |

## 7. Functional requirements: web admin

| Code | Requirement | Phase |
|---|---|---|
| FR-W1 | Admin sign in, forgot password, set new password (same password as app); account menu: my employee profile, change password, help, sign out | 1 |
| FR-W2 | Dashboard (today): On time, Late, Not clocked in, Leave/Sick tiles; needs-review banner; today's employee table with location and status filters; export | 1 |
| FR-W3 | Employees: table (department, office, schedule, work mode, device status, status), filters, search, empty state | 1 |
| FR-W4 | Add employee: personal data, job (department, position, team lead, manager), attendance (office, schedule, **allowed work modes WFO/WFH**), annual leave entitlement, invitation (email / email + SMS / later). Approvers come automatically from the approval flow | 1 |
| FR-W5 | CSV import: download template, upload, row check (ready / needs fixing, inline fix), import, send invitations | 1 |
| FR-W6 | Employee detail: edit data, reset phone link, approve new phone request, approvers, this month's stats, admin access (role + scope), reset password, **Deactivate** (last working day + reason; history kept; can be reactivated), **Delete** (permanent; type Employee ID to confirm; deactivate recommended instead) | 1 |
| FR-W7 | Office locations: name, address, lat/lng (drag pin or paste from Google Maps), radius (slider), max GPS accuracy, time zone. Deleting requires moving employees to another office | 1 |
| FR-W8 | Work hours: schedule list. New/edit: name, repeats (every week / every 2 weeks / custom), work days (any days, not necessarily consecutive; Week 1 / Week 2 rotation + Week 1 start date), start/end time, late tolerance, early-leave threshold, break, cutoff time for Absent, skip holidays, default schedule. The default schedule can't be deleted; deleting another requires moving its employees | 1 |
| FR-W9 | Needs review: flagged clock-ins (weak GPS, location jump, different device, face mismatch, offline clock drift) with selfie, map, signals, last 7 days; Accept / Mark invalid with required note; empty state "All caught up" | 1 |
| FR-W10 | Monthly recap: month and department filters, summary (rate, late, leave/sick, absent), tabs **By employee / By department**, export PDF and Excel | 1 |
| FR-W11 | Audit log: every important change and review decision; filter by actor/date; cannot be deleted from the UI | 1 |
| FR-W12 | Settings › General: company profile, clock-in rules, privacy/retention, mobile app rules (see §9.6) | 1 |
| FR-W13 | Settings › Departments: list + editor (name, code, manager, team leads, positions, default for new employees, approval flow link). Can't be deleted while it has employees | 1 |
| FR-W14 | Settings › Users & roles: admin list, inline role change, action menu **Remove admin access** (with confirmation; pending approvals move to backup), invite admin (employee / non-employee) | 1 |
| FR-W15 | Settings › Approval flows: per request type (Leave, Sick, Overtime, Correction) and per department (default or custom) | 2 |
| FR-W16 | Settings › Leave types: Annual, Special, Maternity/Paternity, Unpaid, and custom types (see §9.4) | 2 |
| FR-W17 | Settings › Holidays: list per year, import national holidays, add/edit/delete (see §9.5) | 2 |
| FR-W18 | Approvals on web for HR (reuses the request detail component) | 2 |
| FR-W19 | **Attendance override** (not designed yet; drawer from Employee detail / Monthly recap / Dashboard row): HR sets a day's status (On time, Late, Absent, Annual leave, Sick, Special leave, Holiday) and/or edits clock-in/out times, with a required note. Original records are kept; the override is shown as "Edited by HR" and is written to the audit log. In Phase 2 an approved Correction request writes the same override | 1 |

---

## 8. Main flows

**A. First sign-in.** Email/ID + password, then one of three outcomes:

- Wrong credentials: error under the field, inputs kept.
- Correct and no phone bound: bind this phone, then Consent → location and camera permissions → offer biometrics → Home.
- Correct but bound to another phone: Device not recognized screen, request sent to HR automatically, Contact HR button.

**B. Clock in.**

1. Home resolves work mode (Office/Home).
2. App gets location and shows its status. For Office the button is enabled only inside the radius. Mock GPS is blocked. Weak GPS may clock in if HR allows it, and the record is flagged Needs review.
3. Selfie with face detection. If no face is found, show guidance.
4. Confirmation screen, then Home shows the clocked-in state.
5. If offline, the event is stored locally with the label "Waiting to sync".

**C. Clock out.** Same as clock in. Before the early-leave threshold, show the Early leave warning. Afterwards show the summary (in, out, duration, status, location, selfie).

**D. Review clock-ins (web).** Dashboard banner or nav badge opens Needs review. HR opens the detail and picks Accept or Mark invalid with a required note. The decision goes to the audit log. A record marked invalid no longer counts as present; the day becomes Absent unless overridden.

**E. Requests and approvals (Phase 2).**

1. Employee picks type, dates, reason and attachment. Insufficient balance blocks submission.
2. Approvers from the flow are notified at the same time (any order) or one after another (in sequence).
3. All approvers must approve. **One decline closes the request immediately.**
4. If an approver is on leave, their step goes to the backup. A reminder is sent after 1 work day without response.
5. **A requester never approves their own request.** Their step goes to the backup (default), is skipped, or escalates one level, per flow setting.
6. Once approved, attendance on those dates becomes the leave/sick status and the balance is deducted.

**F. Employee leaves.** HR picks Deactivate and enters the last working day. After that date the employee is signed out of the app, their phone unbound, and they are removed from schedules and approval flows. History is kept. Delete is only for wrongly entered data.

---

## 9. Business rules

### 9.1 Attendance

| Rule | Default (HR can change) |
|---|---|
| Time | Always server time, stored UTC, shown in the office's time zone (WIB/WITA/WIT). WFH employees use their assigned office's time zone |
| Attendance day | The calendar date of the scheduled shift start in the office time zone. Night shifts crossing midnight belong to the day they start (Phase 3 shifts may refine this) |
| Geofence | Distance ≤ office radius (default 100 m) **and** accuracy ≤ max accuracy (default 50 m). Server re-checks; the client check is only for UX |
| Late tolerance | 5 min after start time; after that Late + minutes late (counted from start time, not from end of tolerance) |
| Early leave | Clock-out before (end time − early-leave threshold) needs confirmation in the app and marks Early leave |
| Forgot clock-out | Status No clock-out after the schedule's cutoff; employee can request a correction (Phase 2) or HR overrides (Phase 1) |
| Absent | Scheduled job sets Absent when there is no clock-in by the cutoff (default 23:59 office time) on a work day without leave or holiday |
| Duplicates | 1 clock-in + 1 clock-out per day; a second attempt is rejected with a clear message |
| Offline | Accepted and marked Offline. Event time = device time + last known server offset (see ARCHITECTURE §7.3). Needs review when the drift can't be trusted or exceeds the threshold (default > 5 min; options 5/15/30) |
| Corrections | Requestable within 3 work days (options 5, 7, end of month); after that only HR |
| WFH | Only for employees with WFH allowed; no geofence; location recorded at clock-in/out |
| Attendance rate | Days present ÷ (work days − leave days − sick days). Present = On time, Late, Early leave, No clock-out. Under 90% is highlighted |

### 9.2 Attendance statuses

On time, Late, Early leave, No clock-out, Absent, Annual leave / Sick / Special leave, WFH (marker, combines with others), Holiday, Needs review (marker), Waiting to sync (client only). See `DESIGN_SYSTEM.md §9` for color, label and icon.

### 9.3 Approval flows (Phase 2)

- Configured per request type (Leave, Sick, Overtime, Correction) with per-department overrides.
- Approvers are relative roles (employee's Team Lead, employee's Manager, all HR) or specific people.
- Order: Any order (all notified at once) or In sequence (top to bottom).
- Approved when: everyone approves. One decline closes the request.
- Approver unavailable (on leave): goes to backup.
- Requester is one of the approvers: goes to backup (default), skipped, or escalated to the next level.
- "All HR" step is satisfied by any one HR approval.
- Default flows: Leave = Team Lead + Manager + HR; Sick = Team Lead + HR; Overtime = Team Lead + Manager; Correction = Team Lead + HR.

### 9.4 Leave types (Phase 2)

| Type | Default rule |
|---|---|
| Annual leave | 12 days/year (Indonesian Manpower Law minimum); usable after 12 months of service; prorated in year one; resets 1 January; carry over max 6 days, expiring 31 March (reminder 2 weeks before); paid; half day allowed (0.5); only work days count; requests < 3 days ahead are allowed but flagged to approvers |
| Special leave | Per event, doesn't reduce balance, paid, proof required (may be uploaded up to 7 days after), taken within 30 days of the event. Events follow UU 13/2003 Art. 93(4) and may be raised but not lowered: own marriage 3, child's marriage 2, child's circumcision/baptism 2, wife gives birth/miscarriage 2, death of spouse/parent/parent-in-law/child/child-in-law 2, death of household member 1 |
| Maternity / paternity | Per company policy and law |
| Unpaid leave | No balance limit; salary deducted (export only) |
| Custom | Example: Long service leave (inactive). Eligibility by department and employee type |

**Sick** is not a leave type. It is its own request type with a doctor's note attachment, visible only to the direct approvers and HR.

> Note: entitlement numbers are product defaults and must be checked with HR or legal counsel before release.

### 9.5 Holidays (Phase 2)

- Types: **Public holiday** (day off, no balance deduction), **Collective leave / cuti bersama** (deducts 1 annual leave day per day; can be turned off), **Company holiday** (paid day off from the company).
- Applies to selected offices or all; can repeat yearly; single day or range.
- "Import national holidays" fills the list from the SKB 3 Menteri. 2026 dates in the design are samples and **must be verified**.
- Adding a holiday on a date with approved leave refunds the balance.
- Nobody is Absent on a holiday. Schedules with "Skip public holidays" follow this list.

### 9.6 General settings (defaults)

| Group | Settings |
|---|---|
| Company | Logo, company name, name in app, default time zone (WIB), language, week start (Monday), date format, Contact HR (WhatsApp, phone, email) |
| Clock-in rules | Selfie at clock-out (on), allow offline clock-in (on), offline drift review (> 5 min), block fake GPS on Android (on), allow weak GPS → Needs review (on), correction window (3 work days) |
| Privacy | Selfie retention **3 months** (options 3/6/12/24), location retention 12 months (6/12/24), editable consent text (versioned) |
| Mobile app | Minimum version, biometric unlock (on), auto sign-out after 30 days without opening the app (7/30/90/never) |

Design note: W16 shows 6/12/24 for selfies and no Contact HR fields; implementation follows this table.

### 9.7 Password and session

- One password for app and web.
- Rules: at least 10 characters, upper and lower case, at least 1 digit, different from the current password.
- Changing password does not sign out the session on the phone being used; other sessions are revoked.
- Removing admin access ends all of that user's web sessions immediately.
- Reset links expire after 60 minutes and are single use.
- Rate limit: 5 failed sign-ins per account per 15 min → temporary lock with a clear message.

---

## 10. Anti-fraud and security

| Threat | Protection | Behavior |
|---|---|---|
| Buddy punching | 1 account 1 phone (app-generated install ID, hashed server-side); selfie + face detection | New phone needs HR approval |
| Fake GPS (Android) | Mock location flag from the OS | Block with a clear message |
| Fake GPS (iOS) | Accuracy, travel speed between events, server-side patterns | Needs review |
| Gallery/screen photo | Live camera only; simple liveness (face present, eyes open where supported) | Reject or flag |
| Phone clock tampering | All timestamps from server; drift recorded | Needs review when large |
| Account takeover | Short access token + revocable refresh token; biometrics | Force sign-out from web |
| Silent changes | Audit log | Cannot be deleted from UI |

Every rejection has its own screen in neutral language with a way out: mock GPS, unknown device, no face, outside radius, permission denied.

## 11. Data, privacy, compliance

Selfies and location are personal data; biometric data is specific personal data under UU PDP No. 27/2022. This section is not legal advice; confirm with company counsel.

- Selfies live in private object storage, are accessed only via short-lived presigned URLs, and are deleted automatically after the retention period.
- Location is recorded only at clock-in/out. No background tracking.
- Consent is shown at first sign-in; HR can edit the text and each version is recorded with who accepted it and when.
- Sick attachments are visible only to direct approvers and HR.
- Tokens: Keychain (iOS), Keystore-backed encrypted storage (Android). Web: httpOnly, Secure, SameSite cookies; tokens never reach browser JavaScript.

---

## 12. Technical architecture (summary)

Full detail in [`ARCHITECTURE.md`](../ARCHITECTURE.md).

| Component | Choice |
|---|---|
| Mobile | Kotlin Multiplatform + Compose Multiplatform, MVVM. Android target first, iOS target added after the pilot. Shared: UI, ViewModels, data, Ktor, SQLDelight (offline queue), Koin. Platform: camera + face detection (ML Kit; Vision on iOS), location + mock detection, biometrics, secure storage, FCM (APNs with iOS) |
| Web admin | Nuxt 4 + Nuxt UI + Tailwind v4, Tabler icons, Pinia, typed client generated from OpenAPI, Nitro BFF holding auth in httpOnly cookies, `@nuxtjs/i18n` |
| Backend | NestJS + Prisma + PostgreSQL 16, Redis + BullMQ for jobs, OpenAPI via `@nestjs/swagger` |
| Files | S3-compatible storage (MinIO in dev); presigned upload/download |
| Notifications | Firebase Cloud Messaging (Android + iOS via APNs), Phase 2 |
| Maps | MapLibre GL + OpenStreetMap tiles on web; Compose canvas mini-geofence on mobile (no tiles) |
| Repo | Bun workspaces + Turborepo monorepo (Bun as package manager, Node 22 runtime): `apps/api`, `apps/admin`, `apps/mobile`, `packages/api-schema` |

## 13. Non-functional requirements

| Aspect | Target |
|---|---|
| Performance | Clock-in API p95 < 1 s under normal load |
| Availability | > 99.5% during working hours |
| Offline | Local queue, automatic sync, no data loss |
| Security | HTTPS only, rate limiting, time-limited tokens, audit log, OWASP ASVS L1 baseline |
| Compatibility | Android 8+ (API 26) at launch; iOS 15+ when iOS ships; web: last 2 versions of Chrome, Edge, Safari, Firefox |
| Language | English first; all strings via i18n; Indonesian later |
| Dark mode | Tokens defined; follow system setting |
| Accessibility | Touch targets 48dp (mobile) / 44px (web), WCAG AA contrast, text label on every status |
| Observability | Structured logs, request IDs, error tracking (Sentry), job failure alerts |

---

## 14. Screen inventory

Design files are in `docs/ui/mobile` and `docs/ui/web`; see [`docs/ui/SCREENS.md`](../ui/SCREENS.md) for files, routes and states.

### Mobile

| ID | Screen | Phase |
|---|---|---|
| M01 / M01a | Splash, Update required | 1 |
| M02 / M02a / M02b / M02c | Login, Forgot password, Reset link sent, Contact HR | 1 |
| M03 | Device not recognized | 1 |
| M04a / M04 | Data consent, Location & camera access | 1 |
| M05 | Home: inside geofence, outside, no shift, on leave, locating, weak GPS, fake GPS blocked, location off, offline, WFH, clocked in, clocked out | 1 |
| M06 | Early leave warning (was listed as M05 in v2.0) | 1 |
| M07 | Selfie (clock in, WFH, clock out), no face detected | 1 |
| M08 | Confirmation (clock in, WFH, clock out) | 1 |
| M09 / M10 | History, Day detail | 1 |
| M11 / M11b / M11c | Profile, Change password, Sign out confirmation | 1 |
| M11a | Reminder settings | 2 |
| M12 | Requests (My requests / To approve) | 2 |
| M13 / M13a | New request: leave, sick, overtime, correction; Leave type picker | 2 |
| M14 | Request detail: leave, sick, overtime, correction, declined | 2 |
| M15 / M15a / M15b | Approvals list, Review request, Decline with note | 2 |
| M16 | Notifications | 2 |

### Web admin

| ID | Screen | Phase |
|---|---|---|
| W01 / W01a–d | Sign in, wrong password, Forgot password, Reset link sent, Set new password | 1 |
| W01e / W01f | Account menu, Change password | 1 |
| W02 | Dashboard | 1 |
| W03 / W03a / W03b | Employees, Employees empty, Import CSV | 1 |
| W04 / W04a / W04b / W04c | Employee detail, Add employee, Delete employee, Deactivate employee | 1 |
| W06 / W06a | Office locations, Delete location | 1 |
| W07 / W07a / W07b / W07c / W07d | Work hours, New schedule, Edit schedule, Delete schedule, Edit rotation | 1 |
| W08 / W08a | Monthly recap by employee / by department | 1 |
| W10 / W10a | Needs review, Needs review empty | 1 |
| W11 | Audit log | 1 |
| W16 | Settings: General | 1 |
| W16d / W16f | Settings: Departments, Add department | 1 |
| W16a / W16a·1 / W16a·2 | Users & roles, User actions menu, Remove admin access | 1 |
| W16c / W16c·1 | Invite admin user (employee / non-employee) | 1 |
| W16b | Settings: Approval flows | 2 |
| W16e / W16e·1 | Settings: Leave types, Special leave | 2 |
| W16g / W16g·1 | Settings: Holidays, Add holiday | 2 |

**Not designed yet (build from existing components):**

| Item | Phase | Approach |
|---|---|---|
| Attendance override drawer (FR-W19) | 1 | `USlideover` with status select, time inputs, required note |
| New phone request approval UI | 1 | Callout + Approve/Decline on Employee detail "Linked phone" card, count in Employees filter |
| Department-filtered recap | 1 | Same as W08 with department filter applied |
| Explicit Role field in Add employee | 1 | Optional "Admin access" section mirroring Employee detail |
| Contact HR fields and 3-month retention option in W16 | 1 | Add to existing General settings cards |
| Add leave type form | 2 | Reuse W16e editor |
| Import national holidays and Edit holiday dialogs | 2 | Reuse W16g·1 modal |
| Special leave event picker on mobile | 2 | Reuse M13a bottom sheet |
| Holidays calendar view | 2 | Optional; table is enough for launch |

## 15. Release, risks, open questions

| Stage | Contents |
|---|---|
| 0. Design | Done: all M and W screens for Phase 1–2 |
| 1. MVP | Auth, WFO/WFH clock-in, offline, history, profile, core web (employees, departments, locations, schedules, review, recap, audit, settings, admin users, attendance override). Pilot with 30 people |
| 2. Requests | Requests + approval flows, leave types, holidays, notifications |
| 3. Advanced | Complex shifts, multi-branch, advanced anti-fraud, integrations |

| Risk | Mitigation |
|---|---|
| Weak GPS indoors | Configurable radius and accuracy; weak GPS goes to Needs review instead of being rejected |
| Fake GPS on iOS | Server analysis + HR review |
| Battery savers killing GPS | Guidance on the permission screen and clear error messages |
| Objections to face/location data | Consent, short retention, transparent communication |
| Name ClockIn already taken | Check PDKI, Play Store, App Store, domains before release |
| Phase 1 without leave requests | FR-W19 attendance override lets HR record leave/sick during the pilot |
| iPhone users during an Android-only pilot | Count them before the pilot; pilot with Android users, loaner phones, or HR override; bring iOS forward if many |

**Decisions made in v2.1 (revisit if wrong):**

- Maps: MapLibre GL + OSM on web, no map tiles on mobile.
- Field staff in Phase 1: use WFH mode (location recorded, no geofence). Multi-geofence per employee is Phase 3.
- Indonesian UI is not required for the pilot; i18n keys are in place from day one.
- Mobile ships Android first; iOS follows right after the pilot.

**Open questions:**

- Final annual leave defaults and special leave event list from HR.
- Official 2026/2027 public holidays and collective leave dates.
- Hosting target for the pilot (single VPS with Docker Compose vs managed cloud).
- Email/SMS provider for invitations (SMS invitations may slip to Phase 2).
