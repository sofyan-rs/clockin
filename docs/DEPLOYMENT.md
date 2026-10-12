# ClockIn Deployment (Docker)

Version 1.0 · 11 Oct 2026 · Companion to [`ARCHITECTURE.md`](ARCHITECTURE.md)

Goal: **one command to run locally, one command to deploy.** Everything server-side ships as Docker images; the mobile app ships through the stores.

| Image / service | Built from | Runs | Port |
|---|---|---|---|
| `clockin-api` | `apps/api/Dockerfile` | `node dist/main.js` (HTTP API) | 3000 |
| `clockin-api` (worker role) | same image | `node dist/worker.js` (BullMQ jobs, no HTTP) | — |
| `clockin-api` (migrate role) | same image | `prisma migrate deploy`, then exits | — |
| `clockin-admin` | `apps/admin/Dockerfile` | `node .output/server/index.mjs` (Nuxt + BFF) | 3001 |
| `postgres` | `postgres:16-alpine` | Database | 5432 (internal) |
| `redis` | `redis:7-alpine` | BullMQ + rate limiting | 6379 (internal) |
| `rustfs` | `rustfs/rustfs` | S3-compatible storage (replaces MinIO, see note below; skip in prod if using managed S3) | 9000 (internal) |
| `caddy` | `caddy:2-alpine` | TLS (auto Let's Encrypt) + reverse proxy | 80, 443 |
| `mailpit` | `axllent/mailpit` | Dev only: catches email | 8025 |

> **Object storage note (Oct 2026):** MinIO CE was archived upstream (Apr 2026) and its Docker images are no longer published. Local dev uses **RustFS** (same S3 API and ports). The production sections below still say `minio`; pick RustFS or managed S3 in D1 and update them. The app only depends on the `S3_*` env vars.

Build principle: **Bun installs and builds, Node 22 runs** (ARCHITECTURE §1). Images are multi-stage, run as non-root, and contain no dev dependencies or source maps of secrets.

---

## 1. Files to add (Stage 0 / F1 and B5 / W5)

```
clockin/
├── .dockerignore
├── bunfig.toml                      # [install] linker = "hoisted" → plain node_modules Node can read
├── docker-compose.yml               # local dev: infra only (apps run with bun run dev)
├── docker-compose.prod.yml          # server: full stack
├── deploy/
│   ├── Caddyfile
│   ├── .env.prod.example
│   ├── deploy.sh                    # pull + migrate + up on the server
│   └── backup.sh                    # pg_dump → S3 bucket, run by cron
├── apps/api/Dockerfile
└── apps/admin/Dockerfile
```

### `.dockerignore`

```
**/node_modules
**/dist
**/.output
**/.nuxt
**/.env*
!**/.env.example
apps/mobile
docs
.git
.turbo
coverage
```

### `bunfig.toml`

```toml
[install]
linker = "hoisted"   # Node runtime in the images expects a classic node_modules tree
```

---

## 2. API image (`apps/api/Dockerfile`)

```dockerfile
# syntax=docker/dockerfile:1.7

# ---- deps: install all workspace deps with Bun (cached on manifests only)
FROM oven/bun:1.2 AS deps
WORKDIR /repo
COPY package.json bun.lock bunfig.toml ./
COPY apps/api/package.json apps/api/
COPY apps/admin/package.json apps/admin/
COPY packages/api-schema/package.json packages/api-schema/
COPY packages/eslint-config/package.json packages/eslint-config/
COPY packages/tsconfig/package.json packages/tsconfig/
RUN bun install --frozen-lockfile

# ---- build: compile Nest + generate Prisma client
FROM deps AS build
COPY . .
RUN bun run --filter api prisma:generate \
 && bun run --filter api build \
 && bun install --frozen-lockfile --production --filter api

# ---- runtime: Node 22, non-root
FROM node:22-slim AS runtime
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates tini \
 && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build --chown=node:node /repo/node_modules ./node_modules
COPY --from=build --chown=node:node /repo/apps/api/node_modules ./apps/api/node_modules
COPY --from=build --chown=node:node /repo/apps/api/dist ./apps/api/dist
COPY --from=build --chown=node:node /repo/apps/api/prisma ./apps/api/prisma
COPY --from=build --chown=node:node /repo/apps/api/package.json ./apps/api/
WORKDIR /app/apps/api
USER node
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=3s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:3000/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
ENTRYPOINT ["/usr/bin/tini","--"]
CMD ["node","dist/main.js"]
```

Notes:
- Prisma `binaryTargets = ["native", "debian-openssl-3.0.x"]` in `schema.prisma` so the engine matches `node:22-slim`.
- `apps/api/src/worker.ts` bootstraps a Nest application context with only the jobs module (no HTTP). Same image, different `command`.
- If the production-only reinstall step proves awkward with workspaces, drop it and copy the full `node_modules`; image size grows but nothing breaks.

## 3. Admin image (`apps/admin/Dockerfile`)

```dockerfile
# syntax=docker/dockerfile:1.7
FROM oven/bun:1.2 AS deps
WORKDIR /repo
COPY package.json bun.lock bunfig.toml ./
COPY apps/api/package.json apps/api/
COPY apps/admin/package.json apps/admin/
COPY packages/api-schema/package.json packages/api-schema/
COPY packages/eslint-config/package.json packages/eslint-config/
COPY packages/tsconfig/package.json packages/tsconfig/
RUN bun install --frozen-lockfile

FROM deps AS build
COPY . .
RUN bun run --filter admin build            # nuxt build → apps/admin/.output (self-contained)

FROM node:22-slim AS runtime
RUN apt-get update && apt-get install -y --no-install-recommends tini && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3001
WORKDIR /app
COPY --from=build --chown=node:node /repo/apps/admin/.output ./.output
USER node
EXPOSE 3001
HEALTHCHECK --interval=15s --timeout=3s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:3001/api/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
ENTRYPOINT ["/usr/bin/tini","--"]
CMD ["node",".output/server/index.mjs"]
```

Nuxt runtime config is read from env at start (`NUXT_API_BASE`, `NUXT_SESSION_SECRET`, …), so **one image works for staging and production**. Add a tiny `server/api/healthz.get.ts` returning `ok`.

---

## 4. Local development (`docker-compose.yml`)

Infra only; apps run on the host with hot reload (`bun run dev`).

```yaml
name: clockin-dev
services:
  postgres:
    image: postgres:16-alpine
    environment: { POSTGRES_USER: clockin, POSTGRES_PASSWORD: clockin, POSTGRES_DB: clockin }
    ports: ["5432:5432"]
    volumes: [pg-data:/var/lib/postgresql/data]
    healthcheck: { test: ["CMD-SHELL","pg_isready -U clockin"], interval: 5s, retries: 10 }
  redis:
    image: redis:7-alpine
    ports: ["6379:6379"]
  rustfs:
    image: rustfs/rustfs:1.0.1
    environment:
      RUSTFS_ACCESS_KEY: clockin
      RUSTFS_SECRET_KEY: clockin-secret
      RUSTFS_CONSOLE_ENABLE: 'true'
    ports: ['9000:9000', '9001:9001']
    volumes: [s3-data:/data]
  s3-init:
    image: peakcom/s5cmd:v2.3.0
    depends_on: [rustfs]
    environment:
      AWS_ACCESS_KEY_ID: clockin
      AWS_SECRET_ACCESS_KEY: clockin-secret
      AWS_REGION: us-east-1
    # Bucket stays private (no policy): the API hands out presigned URLs only.
    entrypoint: ['sh', '-c']
    command:
      - |
        until /s5cmd --endpoint-url http://rustfs:9000 ls >/dev/null 2>&1; do sleep 1; done
        /s5cmd --endpoint-url http://rustfs:9000 ls s3://clockin >/dev/null 2>&1 \
          || /s5cmd --endpoint-url http://rustfs:9000 mb s3://clockin
  mailpit:
    image: axllent/mailpit:v1.24
    ports: ["1025:1025","8025:8025"]
volumes: { pg-data: {}, s3-data: {} }
```

Optional: a `full` profile that also builds and runs `api`, `worker` and `admin` from the Dockerfiles, to smoke-test images locally: `docker compose --profile full up --build`.

---

## 5. Production (`docker-compose.prod.yml`)

Target for the pilot: **one Linux VPS** (2 vCPU / 4 GB is plenty for 30 users) with Docker + Compose plugin. Images come from GHCR; the server never builds.

```yaml
name: clockin
x-api: &api
  image: ghcr.io/${GH_OWNER}/clockin-api:${TAG:-latest}
  env_file: .env
  restart: unless-stopped
  depends_on:
    postgres: { condition: service_healthy }
    redis: { condition: service_started }

services:
  migrate:
    <<: *api
    command: ["npx","prisma","migrate","deploy"]
    restart: "no"
  api:
    <<: *api
    depends_on:
      migrate: { condition: service_completed_successfully }
  worker:
    <<: *api
    command: ["node","dist/worker.js"]
    healthcheck: { disable: true }
    depends_on:
      migrate: { condition: service_completed_successfully }
  admin:
    image: ghcr.io/${GH_OWNER}/clockin-admin:${TAG:-latest}
    env_file: .env
    environment: { NUXT_API_BASE: http://api:3000 }
    restart: unless-stopped
    depends_on: [api]
  postgres:
    image: postgres:16-alpine
    env_file: .env
    volumes: [pg-data:/var/lib/postgresql/data]
    restart: unless-stopped
    healthcheck: { test: ["CMD-SHELL","pg_isready -U $${POSTGRES_USER}"], interval: 5s, retries: 10 }
  redis:
    image: redis:7-alpine
    command: ["redis-server","--appendonly","yes"]
    volumes: [redis-data:/data]
    restart: unless-stopped
  minio:                      # remove if S3_ENDPOINT points to managed storage
    image: minio/minio:latest
    command: server /data
    env_file: .env
    volumes: [minio-data:/data]
    restart: unless-stopped
  caddy:
    image: caddy:2-alpine
    ports: ["80:80","443:443"]
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile:ro
      - caddy-data:/data
    restart: unless-stopped
    depends_on: [api, admin]
volumes: { pg-data: {}, redis-data: {}, minio-data: {}, caddy-data: {} }
```

Only Caddy publishes ports; Postgres, Redis and MinIO stay on the internal Docker network.

### `deploy/Caddyfile`

```
{$API_DOMAIN} {
  encode gzip
  reverse_proxy api:3000
}
{$ADMIN_DOMAIN} {
  encode gzip
  reverse_proxy admin:3001
}
{$FILES_DOMAIN} {
  reverse_proxy minio:9000     # presigned URLs must use this public host (S3_PUBLIC_ENDPOINT)
}
```

### `deploy/.env.prod.example`

```
GH_OWNER=sasana-digital
TAG=latest
API_DOMAIN=api.clockin.example.com
ADMIN_DOMAIN=admin.clockin.example.com
FILES_DOMAIN=files.clockin.example.com

POSTGRES_USER=clockin
POSTGRES_PASSWORD=change-me
POSTGRES_DB=clockin
DATABASE_URL=postgresql://clockin:change-me@postgres:5432/clockin
REDIS_URL=redis://redis:6379

JWT_ACCESS_SECRET=change-me-64-random-bytes
DEVICE_ID_PEPPER=change-me-32-random-bytes
NUXT_SESSION_SECRET=change-me-32-random-bytes

MINIO_ROOT_USER=clockin
MINIO_ROOT_PASSWORD=change-me
S3_ENDPOINT=http://minio:9000
S3_PUBLIC_ENDPOINT=https://files.clockin.example.com
S3_BUCKET=clockin
S3_ACCESS_KEY=clockin
S3_SECRET_KEY=change-me
S3_FORCE_PATH_STYLE=true

SMTP_URL=smtp://user:pass@smtp.provider.com:587
MAIL_FROM="ClockIn <no-reply@clockin.example.com>"
APP_PUBLIC_URL=https://admin.clockin.example.com
API_PUBLIC_URL=https://api.clockin.example.com
SENTRY_DSN=
```

The API signs presigned URLs against `S3_PUBLIC_ENDPOINT` (a second S3 client configured with the public host) so phones can reach them; internal calls (HEAD, delete) use `S3_ENDPOINT`.

### `deploy/deploy.sh`

```bash
#!/usr/bin/env bash
# Usage on the server: ./deploy.sh <tag>   (tag = git sha or release, default latest)
set -euo pipefail
cd "$(dirname "$0")"
export TAG="${1:-latest}"
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d --remove-orphans   # migrate runs first via depends_on
docker compose -f docker-compose.prod.yml ps
docker image prune -f
```

Rollback = `./deploy.sh <previous-tag>`. Migrations must stay backward compatible for one release (expand → migrate → contract) so a rollback never needs a down-migration.

---

## 6. CI: build and publish images

GitHub Actions on push to `main` (and tags):

1. `docker/setup-buildx-action`, log in to GHCR.
2. `docker/build-push-action` for `apps/api/Dockerfile` and `apps/admin/Dockerfile` with `context: .`, tags `:<sha>` and `:latest` (`:vX.Y.Z` on tags), `cache-from/cache-to: type=gha`, platforms `linux/amd64` (add `arm64` if the VPS is ARM).
3. Staging: SSH into the staging host and run `./deploy.sh <sha>` automatically.
4. Production: same step behind a manual approval (GitHub Environments).

Server first-time setup: install Docker, create a `deploy` user, copy `deploy/` folder, fill `.env`, point DNS (3 A records) to the server, `docker login ghcr.io`, run `./deploy.sh`.

---

## 7. Operations

| Task | How |
|---|---|
| Logs | `docker compose -f docker-compose.prod.yml logs -f api worker` (JSON via pino); ship to a log service later |
| DB backup | `deploy/backup.sh` via host cron daily: `pg_dump -Fc` → upload to an off-server S3 bucket, keep 14 daily + 6 monthly |
| Restore drill | Monthly during pilot: restore latest dump into a scratch container and run a smoke query |
| MinIO backup | `mc mirror` to off-server bucket daily (selfies are retention-limited anyway) |
| Seed demo data (staging only) | `docker compose run --rm api node dist/seed.js` |
| One-off admin task | `docker compose run --rm api node dist/cli.js <command>` (e.g. create first Super Admin) |
| Updates | Renovate/Dependabot for base images; rebuild monthly for OS patches |
| Scaling later | Same images move to any container platform (Fly, Render, ECS, k8s); `api` is stateless, `worker` runs as a single replica unless jobs are made concurrency-safe |
