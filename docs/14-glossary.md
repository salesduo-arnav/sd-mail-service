# 14 — Glossary

**Product** — a consuming platform (core-platform, creative-studio, early-reviews, affiliates). The multi-tenant boundary: every row is scoped to a product. Holds branding (name, color, logo, from/reply-to, layout).

**Producer** — code in a product that emits events to sd-mail-service over plain HTTP (shared `X-Service-Key` + `product_slug`). Producers emit *facts*, not send instructions.

**Consumer** — same as producer, from the product's perspective (a product "consumes" the service).

**Event** — a fact a product reports (`trial_started`). Carries an `event_key`, `idempotency_key`, a `subscriber`, and free-form `data`. Ingested into `event_log`.

**`event_key`** — a fact name (e.g. `trial_started`, `integration_connected`) used to match workflow triggers and cancellation keys; the product comes from `product_slug`, not the key.

**`idempotency_key`** — producer-chosen string, unique per product, that dedups retried events.

**Subscriber** — the recipient profile sd-mail-service maintains per `(product, external_id)`: email, name, attributes, `last_seen_at`, timezone, preferences. Built up from events.

**`external_id`** — the product's own user identifier for a subscriber; sd-mail-service does not assign its own.

**Attributes** — arbitrary JSON on a subscriber (`org_id`, `org_name`, `role`, `plan`) available for personalization and audience resolution.

**Workflow** — a declarative definition: a trigger event key → an ordered list of steps. Identified by `(product, key)`. Admin-editable data, versioned.

**Step** — a unit of a workflow: `send`, `delay`, `cancel_on`, or `repeat`. See [04](04-event-and-workflow-model.md).

**`send`** — a step that renders a template and delivers on a channel.

**`delay`** — a step that waits a duration (`1d`, `48h`) or until an absolute time (`until:<data.field>`).

**`cancel_on`** — a step declaring event keys that, if received for the subscriber, cancel the run.

**`repeat`** — a step that re-arms a workflow on a cadence (used for recurring inactivity).

**Trigger** — the event key that starts a workflow.

**Run (WorkflowRun)** — one execution of a workflow for one subscriber, started by one trigger event. Has a status: `active`, `canceled`, `completed`, `failed`.

**Run step (`run_steps`)** — a materialized scheduled instance of a step (e.g. a delayed send), linked to its BullMQ `job_id` for cancellation and auditing.

**Schedule-and-cancel** — the core timing model: schedule a delayed send on the trigger; cancel it if a counter-event arrives; send if still pending at the deadline. See [ADR-0002](adr/0002-schedule-and-cancel.md).

**Template** — the content for a `send` step: `subject` + `body` (Liquid + HTML) + CTA blocks. Identified by a `key` (unique per product) that a `send` step's `template` field references. Wrapped in the product's branded layout at render.

**Liquid** — the templating language (`liquidjs`) used for safe, admin-authored variable interpolation and light logic.

**Layout** — the product-level branded HTML wrapper (`products.layout_html`) around every email body.

**CTA block** — a structured call-to-action (label + link) rendered as a branded button; primary/secondary.

**Channel** — a delivery medium: `email` (v1), `slack`, `in_app`, `sms` (later). Delivery is behind a channel-driver interface.

**Channel driver** — the pluggable component that actually sends on a channel (email driver = SMTP/SES).

**Message** — a single delivery record (`messages`): channel, provider id, status lifecycle (`queued → sent → delivered | bounced | complained | failed | suppressed`), and a `type` (transactional/marketing) + `to_email`.

**Transactional message** — required / 1:1 mail (OTP, password reset, invitation, contact, share). Sent via the synchronous `POST /internal/messages` API. **Bypasses** preference opt-outs and unsubscribe/complaint suppression; blocked only by hard bounce; no unsubscribe footer. Can target a raw email with no subscriber.

**Marketing message** — lifecycle/nudge mail produced by workflows (via events). Respects preferences and all suppressions; carries an unsubscribe footer. The default `type`.

**Transactional send API** — `POST /internal/messages`: renders a named template and sends it inline, returning a delivery result (vs the async `POST /internal/events` pipeline). Used for required mail where the caller must know success/failure.

**Preference** — a subscriber's per-`(category, channel)` opt-in/out, checked at send time.

**Category** — a workflow's classification (`onboarding`, `billing`, `reengagement`) used for preference gating and transactional-vs-marketing rules.

**Suppression** — a `(product, email, reason)` record that blocks sends. `hard_bounce` blocks **both** classes (undeliverable); `complaint`/`unsubscribe`/`manual` block **marketing only** (transactional ignores them). Multiple reasons can coexist for one address.

**Audience** — who a `send` targets: `event_subscriber` (the user on the event) or `org_owner` (resolved from attributes).

**Nightly sweep** — the scheduler backstop that catches state-based workflows (inactivity) for subscribers whose timer was never armed.

**Idempotency** — the property that duplicates don't cause duplicate effects; enforced at ingest, run creation, and send.

**DLQ (dead-letter queue)** — where jobs land after retries are exhausted, for inspection/replay.

**ADR** — Architecture Decision Record; see [adr/](adr/).
