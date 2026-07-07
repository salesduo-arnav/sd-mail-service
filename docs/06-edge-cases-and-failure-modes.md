# 06 — Edge Cases & Failure Modes

Every non-obvious case, with the intended handling. Grouped by area.

## Event ingestion

| Case | Handling |
|------|----------|
| **Duplicate event** (at-least-once producer retries) | `event_log (product_id, idempotency_key)` unique; a duplicate returns `202` and is not re-processed. |
| **Malformed / missing `event_key`** | Reject at API with `400`; nothing enqueued. |
| **Unknown `event_key`** (no workflow matches) | Accepted and logged; simply starts no runs. Not an error — producers may emit events before workflows exist. |
| **Missing `idempotency_key`** | Reject with `400` (producers must supply one) — or, if we choose leniency, synthesize from a hash of `(event_key, external_id, occurred_at)` and document it. Default: **require it**. |
| **Event for a not-yet-known subscriber** | The event upserts the subscriber (create-on-first-touch). |
| **Huge `data` payload** | Enforce a size limit (e.g. 32 KB) at the API. |

## Ordering & timing

| Case | Handling |
|------|----------|
| **Cancel event arrives before its trigger is processed** (out of order) | The cancel is persisted on the subscriber's event timeline. When the trigger's run is created, it checks for a matching cancel event received after the trigger's `occurred_at`; also the run re-checks recent cancels at fire time. Net: the nudge is still suppressed. |
| **Cancel arrives after the send already fired** | Too late by design — the email is out. Logged. (Optional future refinement: a short pre-send "settling" window.) |
| **Trigger never arrives** (subscriber onboarded before feature launch) | Nightly sweep backstops state-based workflows (inactivity, no-activity). Purely event-triggered onboarding emails simply don't fire for pre-existing users — acceptable. |
| **Clock skew / "after 1 day" precision** | Delays are computed from `occurred_at` (or receipt) in **UTC**; day-granularity is expected and acceptable (matches the product intent). Absolute schedules use `until:<data.field>`. |
| **Timezone-sensitive send windows** | v1 sends when the timer fires (UTC). Optional per-subscriber timezone deferred (see [05](05-features.md)). |

## Runs & workflows

| Case | Handling |
|------|----------|
| **Two triggers for the same subscriber+workflow** (e.g. trial restarted) | Dedup guard: at most one active run per `(workflow, subscriber)`; policy = keep the existing active run, or supersede with latest (documented per workflow; default keep-first for one-shots, latest-wins for re-arming timers). |
| **Workflow edited while runs are in flight** | Runs pin `workflow_version_id`; edits only affect **new** runs. No mid-flight surprises. |
| **Workflow disabled while runs are pending** | Pending delayed jobs check `workflow.enabled` at fire time and no-op if disabled. |
| **`delay: until:<field>` where the field is in the past / missing** | Missing → skip the delay (send now) and log; past → fire immediately. |
| **Recurring timer pile-up** | Each re-arm cancels the previously scheduled job; only one inactivity job per subscriber at a time. |

## Rendering & data

| Case | Handling |
|------|----------|
| **Missing template variable** | Renders as empty string; logged with the variable name. Never crashes a run. |
| **Malformed Liquid in a template** | Caught at **save time** (admin editor validates) and at render time (fail the single message, log, don't crash the worker). |
| **Missing recipient email** | Skip the send, mark `message.status = failed` with reason, log. |
| **Template references a variable a producer didn't send** | Empty string + log; the variable manifest in the editor warns admins which vars a workflow actually provides. |

## Preferences, suppression, compliance

| Case | Handling |
|------|----------|
| **Subscriber opts out during a delay window** | Checked at **send time**, not schedule time → the queued nudge is suppressed. |
| **Hard bounce / complaint** | Provider webhook adds the email to `suppressions`; future non-transactional sends are blocked. |
| **Unsubscribe click** | Signed token → add suppression / flip preference; subsequent sends in that category suppressed. |
| **Transactional email to a suppressed address** | Transactional categories may bypass marketing suppression (documented policy) but still respect hard-bounce suppression. |

## Delivery & infrastructure

| Case | Handling |
|------|----------|
| **Provider (SES/SMTP) outage** | Retries with exponential backoff; exhausted → dead-letter queue + alert. Jobs are durable, so nothing is lost on restart. |
| **Worker crash mid-run** | BullMQ redelivers the job; handlers are idempotent (message dedup per run_step prevents double-send). |
| **Multiple worker replicas** | BullMQ per-job locking + idempotent handlers → no double-processing or double-send. |
| **Redis loss** | Delayed jobs live in Redis; mitigate with Redis persistence (AOF) and, for critical schedules, the `run_steps` table lets a recovery job re-enqueue missing schedules. |
| **Postgres unavailable at ingest** | API returns `503`; producers retry (idempotency makes this safe). |

## Security & tenancy

| Case | Handling |
|------|----------|
| **Leaked/compromised product API key** | Revoke (`revoked_at`); blast radius is one product. Keys are stored hashed. |
| **Cross-product data access** | Every query is scoped by `product_id`; product API keys are product-scoped. (Admins are superadmins with full cross-product access by design.) |
| **Spoofed `external_id` / email in an event** | Trust boundary = the product's API key. sd-mail-service does not authenticate end users; producers are responsible for sending correct identities. Optional HMAC signing hardens payload integrity. |
| **Unsubscribe-token tampering** | Tokens are signed (HMAC) and scoped to subscriber+category; invalid tokens are rejected. |

## Producer-side resilience

| Case | Handling |
|------|----------|
| **sd-mail-service is down when a product emits** | Producer SDKs treat emits as fire-and-forget with local retry/short DLQ; a missed event degrades to "no nudge," never a user-facing failure in the product. |
| **Producer double-emits** | Idempotency at ingest makes this safe. |
| **Producer sends stale data** | The event's `data`/subscriber attributes are used as-is at render; producers should send current values. For account-level facts that can change (e.g. plan), the cancel-on model (e.g. `plan.purchased` cancels trial-ended) keeps outcomes correct. |

These handlings are the acceptance criteria for the engine — each should have a test in the implementation (see [12](12-observability-and-ops.md) and the plan's verification section).
