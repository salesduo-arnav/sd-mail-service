# Deploying sd-mail-service

The service ships as **one image** running as **three ECS services** that differ only by their container command:

| ECS service | Command | Notes |
|-------------|---------|-------|
| `sd-mail-api` | `npm start` | Serves the HTTP API. **Runs `migrate:up` on start — the single migrator.** Scale to ≥2 tasks (login/OTP depend on it). |
| `sd-mail-worker` | `node dist/worker.js` | BullMQ consumers (event + delayed sends). No migrations. Safe to scale horizontally. |
| `sd-mail-scheduler` | `node dist/scheduler.js` | Nightly inactivity sweep (Redis-lock guarded). 1 task is enough. |

Only `api` migrates, so worker/scheduler never race the schema. On a fresh schema they may briefly crash-loop until `api` finishes migrating — acceptable (ECS restarts them).

## Prerequisites (AWS)

- **ECR repo** for the image (`vars.ECR_REPOSITORY`).
- **ECS cluster** (`vars.ECS_CLUSTER`) + three services created from the task defs below.
- **RDS Postgres 16** and **ElastiCache/Redis** reachable from the tasks.
- **SES** (or SMTP) for delivery; verified sending domain with SPF/DKIM/DMARC.
- **OIDC deploy role** (`vars.AWS_ROLE_ARN`) trusted by GitHub Actions with ECR push + `ecs:UpdateService`/`DescribeServices`.
- An ALB target group hitting `GET /health` on the `api` service; a hostname (e.g. `mail.salesduo.com`) routed to it (add an upstream to the shared gateway rather than running a gateway here).

## CI/CD

`.github/workflows/ci-cd.yaml` builds+pushes the image and force-new-deploys all three services, then waits for stable + verifies `/health`. `dev` → `staging` environment, `main`/`master` → `production`. Set these as **repo or environment variables/secrets**:

```
AWS_REGION, AWS_ROLE_ARN, ECR_REPOSITORY, ECS_CLUSTER,
ECS_SERVICE_API, ECS_SERVICE_WORKER, ECS_SERVICE_SCHEDULER, HEALTH_URL
```

## Required runtime secrets (SSM Parameter Store / Secrets Manager)

Injected into the task defs (never baked into the image). See `backend/.env.example` for the full list. Production **must** set non-default values for (boot is refused otherwise):

```
ADMIN_SESSION_SECRET, HMAC_SECRET, UNSUB_SECRET, INTERNAL_API_KEY, ADMIN_PASSWORD
PGHOST, PGPORT, PGUSER, PGPASSWORD, PGDATABASE, REDIS_URL
EMAIL_TRANSPORT (smtp|ses) + SMTP_* or SES_REGION
PUBLIC_URL, CORS_ORIGINS, ADMIN_EMAIL
SERVE_ADMIN=true   # if the api should also serve the built admin SPA
```

## Task definitions

`ecs-taskdef.template.json` is a single parameterized template. Register three variants that differ only in `containerDefinitions[0].command` (see the table above); everything else (image, env, secrets, logging) is identical. `NODE_ENV=production` turns on the RDS SSL + secret guards automatically.

## Rollback

`aws ecs update-service --cluster <cluster> --service <svc> --task-definition <previous-revision>` for each service, or re-run the deploy job on the previous commit. Migrations are additive; a rollback of app code does not roll back the schema (design migrations to be backward-compatible).
