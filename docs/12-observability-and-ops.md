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

Alerts: queue lag over threshold, delivery failure spike, bounce/complaint rate over provider limits, DLQ non-empty, scheduler behind.

## Reliability mechanisms

- **Retries + backoff** on delivery and processing; exhausted → **dead-letter queue** + alert.
- **Idempotency** at ingest/run/send (see [04](04-event-and-workflow-model.md)).
- **Durability:** events + scheduled steps persisted in Postgres (`event_log`, `run_steps`); jobs in Redis with AOF persistence. If Redis is lost, a recovery job re-enqueues due `run_steps` that have no completed message.
- **At-least-once** processing with idempotent handlers → safe redelivery, no double-send.

## Scaling

- Stateless **api** and **worker** processes scale horizontally; BullMQ concurrency caps per worker.
- **scheduler** is effectively singleton work; use locks (Redis `SET NX EX`, the pattern core already uses) so multiple replicas don't double-fire the nightly sweep.
- Postgres is the shared state; index hot paths (`event_log` idempotency, `workflow_runs` by subscriber, `messages` by subscriber+date — all in the [schema](03-data-model.md)).

## Runbook (starter)

| Symptom | First checks |
|---------|--------------|
| Emails not sending | Worker alive? Queue depth? Provider creds/quota? DLQ? Recent `messages.status=failed` errors? |
| Nudges firing that should've canceled | Are producers emitting the cancel event (`integration.connected`, `generation.completed`)? Check `event_log` for the subscriber; check run `status`/`cancel_on`. |
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
