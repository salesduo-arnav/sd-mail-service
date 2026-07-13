# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

`sd-mail-service` is a **standalone, multi-product lifecycle/notification email service** for SalesDuo. Products integrate over plain HTTP (no SDK) by emitting **events**; the service owns templates, workflows, scheduling, delivery, preferences, and compliance. It never touches a product's database. Full design lives in [`docs/`](docs/) — start with `docs/00-overview.md`, `docs/02-architecture.md`, and `docs/04-event-and-workflow-model.md`.

Two deployables in one repo: `backend/` (Express + TypeScript + Sequelize + BullMQ) and `admin/` (React + Vite superadmin UI). Both are versioned together.

## Commands

Most workflows are wrapped in the root **`Makefile`** (`make help` lists targets). Key ones:

- **Full stack in Docker:** `make up` → `make seed-docker` (once, bootstraps superadmin) → `make urls`. The canonical products/templates/workflows are **not** seeded — provision them on demand from the admin UI (Products → **Provision catalog**), idempotently from `src/provisioning/catalog.ts`.
- **Host dev** (infra in Docker, Node on host): `make setup` → `make infra` → then in separate terminals: `make dev-api`, `make dev-worker`, `make dev-scheduler`, `make admin`
- **Reset local data:** `make reset` (down + wipe volumes)

Backend, run from `backend/`:
- `npm run dev` — self-contained: waits for DB → migrates → seeds → starts API (`:3110`, hot reload). `npm run dev:worker` / `npm run dev:scheduler` are the other two processes (each waits for DB, so start order is irrelevant).
- `npm test` — Jest suite. Runs with `NODE_ENV=test PGDATABASE=sd_mail_test --runInBand`. Single test: `npm test -- duration.test.ts` or `npm test -- -t "name"`.
- `npm run lint` — ESLint. `npm run build` — `tsc`.
- `npm run migrate:up` / `migrate:down`; create one with `npm run migrate:create -- <name>` (raw `.js` files in `backend/migrations/`, **hand-written, not generated from models**).
- `npm run openapi` — regenerate `docs/openapi.json` from `src/openapi/spec.ts` (served live at `GET /openapi.json`, rendered at `/docs`).

Admin, run from `admin/`: `npm run dev` (`:5180`, proxies `/admin` → `:3110`), `npm run build`, `npm run typecheck`, `npm run lint`.

**Ports (deliberately non-overlapping** so this runs alongside core-platform/studio): API `3110`, Admin `5180`, Postgres `5442`, Redis `6389`, Mailhog SMTP `1026`/UI `8026`. Local email is captured by Mailhog — nothing leaves the machine in dev.

## Architecture

### Three processes, one image
`backend/` builds one image with three entrypoints: `src/server.ts` (HTTP API), `src/worker.ts` (BullMQ consumers), `src/scheduler.ts` (nightly sweep, behind a Redis lock so replicas are safe). They share models/config. Only the API listens on a port; worker and scheduler are queue-driven. **Enqueuing lives in the API; the actual work runs in the worker** — if you add a queue, wire the producer in `src/queues/index.ts` and a consumer in `src/queues/*.worker.ts` (started from `worker.ts` or `scheduler.ts`).

### Request → event → workflow flow (the core)
This is the "schedule-and-cancel" engine. Read these in order:
1. **Ingest** (`src/services/ingest.service.ts`): `POST /internal/events` upserts the subscriber by `(product_id, external_id)`, writes an `event_log` row idempotently on `(product_id, idempotency_key)`, and enqueues a job (jobId = event row id, so enqueue is idempotent).
2. **Process** (`src/services/engine/process-event.ts`): worker picks up the job. **Serialized per-subscriber via a Redis lock** (`withLock`) so concurrent same-subscriber events can't double-fire. It matches → starts runs, then cancels runs this event defuses (excluding the run it just started).
3. **Match** (`src/services/engine/trigger-matcher.ts`): finds enabled workflows whose `trigger_event_key` matches. Dedup policy: **keep-first** (one active run per workflow+subscriber) unless the workflow's own trigger is in its `cancel_on` keys, in which case **latest-wins** (re-arms, cancels priors) — e.g. an `inactive_14d` nudge triggered by `activity` and canceled by `activity`. Also handles **out-of-order cancels** by comparing effective event time (`occurred_at ?? received_at`), not processing order.
4. **Execute** (`src/services/engine/run-executor.ts`): walks the declarative step list. Leading (no-delay) sends deliver inline; sends after a `delay` become BullMQ **delayed jobs** (jobId = `run_step` id, so they're individually cancelable). `cancel_on` keys are aggregated onto the run row.
5. **Cancel** (`src/services/engine/cancel.service.ts`): setting a run to `canceled` also removes its pending delayed jobs by jobId.

**Workflows are declarative JSON**, not code. The step vocabulary (`send` / `delay` / `cancel_on` / `repeat`) is defined in `src/types/workflow.ts` and stored on `workflow_versions.steps`. A `Workflow` points at an `active_version_id` (versioned, immutable versions authored in the admin). Durations like `"1d"`, `"48h"`, `"until:<data.field>"` are parsed in `src/utils/duration.ts`.

### Delivery (shared by three callers)
`src/services/delivery/send.service.ts` — `deliver()` is the single send path used by the transactional API, the workflow engine, and marketing campaigns. It is **message-class-aware**:
- **transactional**: bypasses preferences + unsubscribe/complaint suppression (blocked only by `hard_bounce`), no unsubscribe footer.
- **marketing**: honors preferences (`isOptedOut`) + all suppressions, appends an unsubscribe footer + `List-Unsubscribe` header.

It is **idempotent**: one `messages` row per `run_step` (engine) or per `(campaign, subscriber)` (campaigns); a retried job short-circuits if already `sent`/`suppressed`. Transient provider errors **throw** (BullMQ retries); on the job's final attempt the caller sets `finalAttempt` so a failure is recorded as terminal `failed` instead of hanging. Transport is abstracted in `src/services/delivery/email-driver.ts` (SMTP via Nodemailer or SES, chosen by `EMAIL_TRANSPORT`). Rendering: Liquid templates (`src/services/render/`) wrapped in the product's brand layout.

### Auth (two independent planes)
This is an **internal-only** service — there are no per-product API keys.
- **Producer API** (`/internal/*`, `serviceAuth`): trusted first-party producers use one shared key `X-Service-Key` (= `env.INTERNAL_API_KEY`) and name the product per request via `product_slug` in the body. Endpoints: `POST /internal/events` (async ingest), `/internal/messages` (sync transactional template send), `/internal/email/send` (pre-rendered relay). `serviceAuth` resolves the product by slug (`findProductBySlug`), not from the request identity.
- **Admin API** (`/admin/*`, `requireAdmin`): single superadmin, **no RBAC**, full cross-product access. Signed JWT in an httpOnly cookie (`sdmail_admin`); the guard re-checks the admin still exists on every request.

Route groups mounted in `src/app.ts`: `/admin` (control plane), `/webhooks` (provider bounce/complaint), `/` public (`GET /u/:token` unsubscribe), `/internal` (producers). In production (or `SERVE_ADMIN=true`) the API also serves the built admin SPA from `admin/dist`.

### Config
`src/config/env.ts` validates **all** of `process.env` with Zod at boot and fails fast. Import the default `env` export — never read `process.env` directly. In production it additionally refuses to boot with default secrets (`*_SECRET`, `INTERNAL_API_KEY`), the default `ADMIN_PASSWORD`, or incomplete SMTP config. Reference: `backend/.env.example`.

## Conventions worth knowing

- **Data model**: 13 Sequelize models in `src/models/`; all associations are declared centrally in `src/models/index.ts` (imported for side effects as `import './models'`). Everything is product-scoped. The DBML source of truth is `docs/schema.dbml`.
- **Errors**: throw the helpers in `src/utils/errors.ts` (`unauthorized`, `notFound`, …) and wrap async handlers in `asyncHandler`; a central `errorHandler` formats the response. Don't hand-roll `res.status().json()` for errors.
- **Migrations are authoritative** for schema — models are not auto-synced. Add a migration for any schema change.
- **Admin UI** is shadcn/ui (Radix + Tailwind) with `@/` aliased to `admin/src/`; pages in `admin/src/pages/`, API calls via `admin/src/lib/`.
- Windows dev note: the Makefile launches the TS watcher via `node node_modules/ts-node-dev/lib/bin.js` (not an npm/.cmd shim) to avoid the "Terminate batch job" prompt and stuck-terminal issues on Ctrl-C.
