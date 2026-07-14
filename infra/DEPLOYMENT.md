# Deploying sd-mail-service

One Docker image (`backend/Dockerfile`), run as **three processes** that differ only by their command. Same pattern as core-platform / listings-optimizer.

## Services we run

| Service | Command | Count | Notes |
|---|---|---|---|
| `sd-mail-api` | `npm start` | ≥2 | HTTP API + serves the admin UI. **Runs DB migrations on start** (the only migrator). OTP/reset depend on it → keep ≥2. |
| `sd-mail-worker` | `node dist/worker.js` | ≥1 | BullMQ consumers (sends, delayed nudges). No migrations. Scale freely. |
| `sd-mail-scheduler` | `node dist/scheduler.js` | 1 | Nightly inactivity sweep (Redis-lock guarded). One is enough. |

Only `api` listens on a port (`3000` in-container). Worker/scheduler are queue-driven.

## What we need (infra)

- **Postgres 16** — RDS in prod (the image bundles the RDS CA for SSL; `NODE_ENV=production` turns SSL on).
- **Redis** — ElastiCache or the shared `shared-redis`. Used for BullMQ + scheduler locks.
- **SES** (recommended) or an SMTP provider — for actual delivery. See below.
- **ALB target** hitting `GET /health` on the api service; a hostname (e.g. `mail.salesduo.com`) routed to it.
- **ECR repo + ECS services** (3, from `ecs-taskdef.template.json`) or a host running `docker compose`. Deploy is via `.github/workflows/ci-cd.yaml` (OIDC → ECR push → `ecs update-service --force-new-deployment`), matching the sibling repos.

> **Mailhog is dev-only.** It's the local SMTP sink (compose). **Do not run it in prod** — set `EMAIL_TRANSPORT=ses` (or real SMTP creds). That's the only email-transport difference between dev and prod.

## Where `.env` goes

- **Local / docker-compose:** `backend/.env` (copy from `backend/.env.example`; `make env` does this). Compose reads it via `env_file`.
- **Prod (ECS):** do **not** ship a `.env` — inject the vars from **AWS Secrets Manager / SSM** into the task def (see `ecs-taskdef.template.json`). `backend/.env.example` is the field list.

## Env fields to fill

| Var | Prod value |
|---|---|
| `NODE_ENV` | `production` |
| `PORT` | `3000` |
| `PUBLIC_URL` | `https://mail.salesduo.com` (builds unsubscribe links) |
| `CORS_ORIGINS` | admin origin, e.g. `https://mail.salesduo.com` |
| `SERVE_ADMIN` | `true` (api also serves the admin SPA) |
| `PGHOST` `PGPORT` `PGUSER` `PGPASSWORD` `PGDATABASE` | RDS connection |
| `REDIS_URL` (`REDIS_PASSWORD`) | ElastiCache URL |
| `EMAIL_TRANSPORT` | `ses` (or `smtp`) |
| `SES_REGION` | `us-east-1` |
| `SMTP_HOST/PORT/USER/PASS` | only if `EMAIL_TRANSPORT=smtp` |
| `SMTP_FROM` | fallback From, e.g. `"SalesDuo" <no-reply@salesduo.com>` |
| `SES_SNS_TOPIC_ARN` | (optional) lock the feedback webhook to your topic |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | superadmin login (seeded once) |

## Keys/secrets to generate

Generate strong random values (e.g. `openssl rand -hex 32`). **Prod refuses to boot** if any of the first three keep their `dev-` default, or if `ADMIN_PASSWORD` is still `admin12345`.

- `INTERNAL_API_KEY` — shared service key all producers send as `X-Service-Key` (must match core-platform & listings-optimizer's `SD_MAIL_SERVICE_KEY`).
- `ADMIN_SESSION_SECRET` — signs the admin session cookie.
- `UNSUB_SECRET` — signs one-click unsubscribe links.
- `ADMIN_PASSWORD` — superadmin password.

No per-product API keys exist — producers auth with the one `INTERNAL_API_KEY` + `product_slug`.

## Webhooks to configure

**SES bounce/complaint feedback** → keeps the suppression list correct:

1. Create an **SNS topic** (e.g. `ses-feedback`).
2. Add an **HTTPS subscription** → `https://mail.salesduo.com/webhooks/ses`. The service auto-confirms the subscription (verifies the SNS signature) and processes `Bounce` (→ `hard_bounce` suppression) and `Complaint` (→ `complaint` suppression).
3. In **SES → Configuration set / Identity → Feedback**, set Bounce + Complaint notifications to that SNS topic.
4. (Optional) set `SES_SNS_TOPIC_ARN` to reject anything not from that topic.

## Amazon SES setup (one-time)

1. **Verify the sending domain** (`salesduo.com`) in SES → add the DKIM CNAME records to DNS.
2. Add **SPF** (`v=spf1 include:amazonses.com ~all`) and a **DMARC** record.
3. **Request production access** (move out of the SES sandbox) so you can send to any recipient.
4. Delivery auth — pick one:
   - **SES API (preferred):** give the ECS **task role** `ses:SendRawEmail`; no keys in env (`EMAIL_TRANSPORT=ses`, `SES_REGION` set).
   - **SES SMTP:** create SMTP credentials in SES and set `EMAIL_TRANSPORT=smtp` + `SMTP_HOST/PORT/USER/PASS`.
5. Confirm `SMTP_FROM` / each product's `from_email` is on the verified domain.

## Deploy & rollback

- **Deploy:** push to `dev` → staging, `main` → production (CI builds the image, pushes to ECR, force-new-deploys all three services, waits stable, checks `/health`).
- **First run:** after the api is up, `POST`-seed the superadmin once (`npm run seed:prod` in the api container), then log into the admin and click **Products → Provision catalog**.
- **Rollback:** `aws ecs update-service --service <svc> --task-definition <prev-revision>` for each service, or re-run the deploy on the previous commit. Migrations are additive — keep them backward-compatible (code rollback doesn't roll back schema).
