# 12 — Observability & Operations

## Logging

- **Structured JSON logs** across api/worker/scheduler with correlation ids: `event_id`, `subscriber_id`, `workflow_id`, `run_id`, `message_id`, `product`.
- Log key transitions: event ingested/deduped, run created, step scheduled, run canceled (with cause), send attempted/succeeded/failed, suppression hit.
- Ship to the same stack core-platform uses (Loki/Grafana per its `docker-compose`).

## Metrics

| Metric | Why |
|--------|-----|
| Events ingested / deduped (by product, event_key) | Producer health, dedup rate |
| Queue depth + processing latency (event, delayed, delivery) | Backpressure / lag |
| Runs created / canceled / completed / failed | Workflow behavior; cancel ratio validates schedule-and-cancel |
| Messages sent / delivered / bounced / complained / failed | Deliverability |
| Suppressions added (by reason) | List hygiene, sender reputation |
| Delayed-job scheduling accuracy (fired vs due) | Scheduler health |
| Send latency (trigger→send for immediate) | UX for welcome emails |
| **Transactional send success rate + p95 latency** (`/internal/messages`, by product/template) | **Availability-critical** — login/signup depend on it |

Alerts: queue lag over threshold, delivery failure spike, bounce/complaint rate over provider limits, DLQ non-empty, scheduler behind, and — **paging** — transactional send failure-rate or p95 latency over threshold (a degraded `/internal/messages` blocks logins).

## Reliability mechanisms

- **Retries + backoff** on delivery and processing; exhausted → **dead-letter queue** + alert.
- **Idempotency** at ingest/run/send (see [04](04-event-and-workflow-model.md)).
- **Durability:** events + scheduled steps persisted in Postgres (`event_log`, `run_steps`); jobs in Redis with AOF persistence. If Redis is lost, a recovery job re-enqueues due `run_steps` that have no completed message.
- **At-least-once** processing with idempotent handlers → safe redelivery, no double-send.

## Scaling

- Stateless **api** and **worker** processes scale horizontally; BullMQ concurrency caps per worker. Because required mail (OTP/reset) has **no core SMTP fallback** ([ADR-0006](adr/0006-transactional-and-migration.md)), run the **api** (which serves `/internal/messages`) with enough replicas + health checks that a single instance loss never blocks logins; keep the synchronous send's timeout tight with a small retry budget so a slow provider fails fast rather than hanging the caller.
- **scheduler** is effectively singleton work; use locks (Redis `SET NX EX`, the pattern core already uses) so multiple replicas don't double-fire the nightly sweep.
- Postgres is the shared state; index hot paths (`event_log` idempotency, `workflow_runs` by subscriber, `messages` by subscriber+date — all in the [schema](03-data-model.md)).

## Runbook (starter)

| Symptom | First checks |
|---------|--------------|
| Emails not sending | Worker alive? Queue depth? Provider creds/quota? DLQ? Recent `messages.status=failed` errors? |
| **OTP/login mail failing (page)** | `api` replicas healthy? `/internal/messages` p95 + failure rate? Provider (SES) status/quota? Is the address on the `hard_bounce` suppression list? This blocks logins — treat as SEV. |
| Nudges firing that should've canceled | Are producers emitting the cancel event (`integration_connected`, `generation_completed`)? Check `event_log` for the subscriber; check run `status`/`cancel_on`. |
| Duplicate emails | Check `messages` per `run_step`; verify idempotency keys from producer; check for multiple active runs. |
| Wrong/blank personalization | Template variable vs event `data`/attributes; check render logs for missing-var warnings. |
| Deliverability drop | Bounce/complaint metrics; suppression growth; domain auth (SPF/DKIM/DMARC); SES reputation dashboard. |
| Scheduler behind | Scheduler process health; lock contention; Redis latency. |

## Data lifecycle

- Retention jobs prune `event_log`/`messages` per policy; keep aggregates for analytics.
- Backups: RDS automated backups; Redis AOF. Test restore of `run_steps` → re-enqueue path.

## Environments

- `dev` (local docker: Postgres + Redis + Ethereal SMTP), `staging`, `prod`. Same process topology; SES in staging/prod, Ethereal in dev for safe inspection.
- CI/CD mirrors sibling repos' GitHub Actions; migrations run on deploy.

## Testing hooks (for build)

Each edge case in [06](06-edge-cases-and-failure-modes.md) maps to a test. Local E2E: set a workflow delay to seconds, emit the trigger, confirm send in Ethereal, emit the cancel and confirm no-op, emit a duplicate and confirm single send.
