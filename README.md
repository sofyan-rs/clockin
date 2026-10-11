# ClockIn

Office attendance system: a mobile app for employees to clock in/out with GPS + selfie, and a web admin for HR to manage employees, schedules, locations, reviews and monthly recaps.

> Status: **pre-implementation**. Design for Phase 1–2 is done; code starts with the backend. See [`PLAN.md`](PLAN.md).

## Stack

| Part | Tech | Path |
|---|---|---|
| Backend API | NestJS · Prisma · PostgreSQL 16 · Redis/BullMQ · S3 (MinIO) | `apps/api` |
| Web admin | Nuxt 4 · Nuxt UI · Tailwind v4 · Pinia | `apps/admin` |
| Mobile | Kotlin Multiplatform · Compose Multiplatform · MVVM (**Android first**, iOS after pilot) | `apps/mobile` |
| API contract | OpenAPI 3.1 + generated TS client | `packages/api-schema` |

## Documentation

| Doc | What it answers |
|---|---|
| [`docs/implementation/PRD.md`](docs/implementation/PRD.md) | What we build and why: roles, scope per phase, requirements, business rules |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | How: repo layout, modules, data model, API, attendance engine, jobs, security |
| [`docs/implementation/DESIGN_SYSTEM.md`](docs/implementation/DESIGN_SYSTEM.md) | Tokens, components, status vocabulary for Nuxt UI and Compose |
| [`docs/ui/SCREENS.md`](docs/ui/SCREENS.md) | Every designed screen (PNG + HTML) with route / Compose destination and phase |
| [`docs/CODE_STRUCTURE.md`](docs/CODE_STRUCTURE.md) | Folder layout and coding patterns per app (feature folders, layers, MVVM), with examples |
| [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) | Docker images, local compose, production compose + Caddy, deploy / rollback / backup |
| [`PLAN.md`](PLAN.md) | Implementation order and milestones: backend → web admin → mobile |
| [`docs/CONTRIBUTION.md`](docs/CONTRIBUTION.md) | Workflow, conventions, definition of done |

## Getting started (once Stage 0 is done)

Requirements: Bun 1.2+ (package manager + scripts), Node 22 LTS (runtime for API and Nuxt), Docker. Mobile needs JDK 17+ and Android Studio (Xcode 16+ on macOS only once iOS work starts).

```bash
bun install
cp apps/api/.env.example apps/api/.env
cp apps/admin/.env.example apps/admin/.env
docker compose up -d                 # postgres, redis, minio, mailpit
bun run --filter api prisma:migrate
bun run --filter api db:seed         # demo company + admin users
bun run dev                          # api :3000, admin :3001
```

| Service | URL |
|---|---|
| API / OpenAPI docs | http://localhost:3000/v1 · http://localhost:3000/docs |
| Web admin | http://localhost:3001 |
| Mailpit (dev email) | http://localhost:8025 |
| MinIO console | http://localhost:9001 |

Mobile: open `apps/mobile` in Android Studio and run the `dev` flavor; on the emulator the API is at `http://10.0.2.2:3000`. iOS (`apps/mobile/iosApp` in Xcode) comes after the Android pilot.

## Phases

1. **MVP:** auth + device binding, WFO/WFH clock-in with selfie, offline, history, profile; web dashboard, employees, departments, locations, schedules, review, recap, audit, settings, admin users.
2. **Requests:** leave/sick/overtime/correction with approval flows, leave types, holidays, push notifications.
3. **Advanced:** complex shifts, multi-branch, advanced anti-fraud, integrations.

## Deploy

Server side is Docker only: `clockin-api` (API, worker, migrations) and `clockin-admin`, plus Postgres, Redis, MinIO and Caddy in `docker-compose.prod.yml`. On the server: copy `deploy/`, fill `.env`, run `./deploy.sh <tag>`. Details in [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md).

Owner: Sofyan (Sasana Digital).
