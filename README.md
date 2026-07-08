# sd-mail-service

A **standalone, multi-product notification / lifecycle-messaging service** for SalesDuo. Any product — core-platform, AI Creative Studio, and platforms outside the micro-tool system (early-reviews, affiliates) — sends users **personalized, event-driven emails** (welcome, onboarding nudges, trial-ended, re-engagement) by **emitting events**. The service owns templates, scheduling, delayed/conditional nudges (schedule-and-cancel), delivery, preferences, and compliance. It never touches a product's database.

> **Status: implemented.** The service (backend + React admin) is built in `backend/` (Express + TypeScript + Sequelize + BullMQ) and `admin/` (React + Vite), following the phased plan in [docs/13-rollout-phases.md](docs/13-rollout-phases.md). The full design lives in [`docs/`](docs/).

## Dedicated ports (standalone)

sd-mail-service uses its own non-overlapping port block so it runs alongside core-platform, the studio stack, and their shared Redis:

| Service | Port | (avoids) |
|---------|------|----------|
| **API** | `3100` | core-platform api `3000` |
| **Admin UI** | `5180` | core frontend `5173/5174` |
| **Postgres** | `5442` | core `5432`, studio `5434` |
| **Redis** | `6389` | studio `shared-redis` `6379` |
| **Mailhog** | SMTP `1026` / UI `8026` | defaults `1025/8025` |

## Quickstart

> Common commands are wrapped in a **[`Makefile`](Makefile)** — run `make help` to list them. Typical flows:
> - Docker: `make up` → `make seed-docker` → `make urls`
> - Host: `make setup` → `make infra` → `make dev-api` (+ `dev-worker`, `dev-scheduler`, `admin` in other terminals)
> - `make smoke` fires sample events · `make reset` wipes the local db/redis.
>
> `npm run dev` (i.e. `make dev-api`) is self-contained: it **waits for the DB, runs migrations, seeds, then starts the API**. The worker/scheduler each wait for the DB too, so start order doesn't matter.

### With Docker (everything in containers)

```bash
cp backend/.env.example backend/.env      # keep dev defaults
docker compose up --build                 # postgres + redis + mailhog + api + worker + scheduler + admin
docker compose exec api npm run seed      # once: superadmin + demo/creative-studio products + dev keys
# Admin  → http://localhost:5180   (login: admin@salesduo.com / admin12345)
# API    → http://localhost:3100/health
# Docs   → http://localhost:3100/docs   (rendered OpenAPI / Redoc)
# Mailhog→ http://localhost:8026   (view sent email)
```

### Without Docker (app on host)

Start only the infra in Docker (or point at your own Postgres/Redis on the same ports), then run the Node processes on the host:

```bash
docker compose up -d postgres redis mailhog   # infra only, on 5442 / 6389 / 1026+8026

cd backend
cp .env.example .env
npm install
npm run dev            # waits for DB → migrates → seeds → starts api :3100
# in separate terminals (each waits for the DB, so order doesn't matter):
npm run dev:worker     # queue worker
npm run dev:scheduler  # nightly sweep

cd ../admin && npm install && npm run dev   # admin :5180 (proxies /admin → :3100)
```

`npm test` runs the Jest suite (uses `PGDATABASE=sd_mail_test`); `npm run lint` lints.

### Seeded credentials & dev keys

`npm run seed` creates a default superadmin and two products with deterministic dev API keys (dev only — never use in prod):

| What | Value |
|------|-------|
| Superadmin login | `admin@salesduo.com` / `admin12345` (override via `ADMIN_EMAIL` / `ADMIN_PASSWORD`) |
| `demo` product key | `sdm_demo_dev_key_do_not_use_in_prod` |
| `creative-studio` product key | `sdm_cs_dev_key_do_not_use_in_prod` |

The `demo` product includes a **3-second delay** workflow (`demo.start` → cancel on `demo.done`) for fast schedule-and-cancel testing.

### Try it (smoke test)

With the api + worker running and Mailhog open at **http://localhost:8026**:

```bash
# 1) Immediate welcome email (Creative Studio)
curl -X POST http://localhost:3100/v1/events \
  -H "Authorization: Bearer sdm_cs_dev_key_do_not_use_in_prod" -H "Content-Type: application/json" \
  -d '{"event_key":"creative_studio.trial_started","idempotency_key":"t1",
       "subscriber":{"external_id":"u1","email":"you@example.com","name":"You"},
       "data":{"trial_ends_at":"2026-07-22T10:00:00Z","start_link":"https://app/start"}}'

# 2) Schedule-and-cancel: fires in ~3s unless canceled first
curl -X POST http://localhost:3100/v1/events \
  -H "Authorization: Bearer sdm_demo_dev_key_do_not_use_in_prod" -H "Content-Type: application/json" \
  -d '{"event_key":"demo.start","idempotency_key":"d1","subscriber":{"external_id":"d1","email":"you@example.com"}}'
# cancel it (send within 3s, same subscriber) → no email fires
curl -X POST http://localhost:3100/v1/events \
  -H "Authorization: Bearer sdm_demo_dev_key_do_not_use_in_prod" -H "Content-Type: application/json" \
  -d '{"event_key":"demo.done","idempotency_key":"d1-done","subscriber":{"external_id":"d1"}}'

# 3) Synchronous transactional OTP (returns the delivery result)
curl -X POST http://localhost:3100/v1/messages \
  -H "Authorization: Bearer sdm_cs_dev_key_do_not_use_in_prod" -H "Content-Type: application/json" \
  -d '{"template_key":"login_otp","to":{"email":"you@example.com","name":"You"},
       "data":{"otp":"123456","expires_minutes":5}}'
```

More endpoints + language snippets: [`docs/integration/http-examples.md`](docs/integration/http-examples.md) · OpenAPI at `GET /openapi.json`.

### Cleanup

```bash
docker compose down -v      # stop containers + remove volumes (wipes local db/redis)
```

### Layout

| Path | What |
|------|------|
| `backend/` | Express/TS service — three entrypoints (`server.ts` api, `worker.ts`, `scheduler.ts`) off one image |
| `admin/` | React + Vite admin UI (superadmin); served by the api from `admin/dist` in prod |
| `docs/` | Architecture, data model, engine spec, ADRs, diagrams |
| `docker-compose.yml` | Local stack on the dedicated ports above |

### Environment

All config is validated at boot by `backend/src/config/env.ts`; a missing/invalid var fails fast. See [`backend/.env.example`](backend/.env.example) for the full reference (Postgres `PG*`, `REDIS_URL`, `EMAIL_TRANSPORT` + SMTP/SES, and the `*_SECRET` / `INTERNAL_API_KEY` secrets).

## Documentation

Everything lives in **[`docs/`](docs/)**. Start with the [docs README](docs/README.md), then:

- [Overview](docs/00-overview.md) · [Rationale & alternatives](docs/01-rationale-and-alternatives.md)
- [Architecture](docs/02-architecture.md) · [Data model (DBML + ER)](docs/03-data-model.md) · [Event & workflow model](docs/04-event-and-workflow-model.md)
- [Features](docs/05-features.md) · [Edge cases](docs/06-edge-cases-and-failure-modes.md) · [Creative Studio worked example](docs/07-creative-studio-example.md)
- [Integration guide](docs/08-integration-guide.md) · [Admin UI](docs/09-admin-ui.md) · [Delivery & channels](docs/10-delivery-and-channels.md)
- [Security & compliance](docs/11-security-and-compliance.md) · [Observability & ops](docs/12-observability-and-ops.md) · [Rollout phases](docs/13-rollout-phases.md) · [Glossary](docs/14-glossary.md)
- [Architecture Decision Records](docs/adr/)

Import-ready artifacts: **[`docs/schema.dbml`](docs/schema.dbml)** (paste into [dbdiagram.io](https://dbdiagram.io)) and **[`docs/diagrams/`](docs/diagrams/)** (Mermaid `.mmd` files).

## At a glance

Build in-house · Node.js + TypeScript (Express + Sequelize, matching core-platform) · Postgres · BullMQ/Redis · **schedule-and-cancel** event model · subscriber profiles · declarative admin-editable workflows · email delivery (multi-channel-ready) · owns preferences + unsubscribe · single-superadmin admin UI. Producers integrate via **plain HTTP** (no SDK) — see the OpenAPI spec + `curl` examples.
