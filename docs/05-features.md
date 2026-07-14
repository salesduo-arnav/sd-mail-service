# 05 — Feature Catalog

What sd-mail-service does, grouped by capability. The right-hand column marks **v1** (needed to ship the Creative Studio emails) vs **later**.

## Event ingestion

| Feature | Phase |
|---------|-------|
| Single idempotent `POST /internal/events` (async marketing/lifecycle) | v1 |
| **Synchronous `POST /internal/messages` (transactional send)** — returns delivery result; targets a raw email or a subscriber | v1 |
| **Message classes** — `transactional` (required mail, bypasses opt-out/unsubscribe, no footer) vs `marketing` | v1 |
| `POST /internal/email/send` (pre-rendered relay) | v1 |
| Shared service-key auth (`X-Service-Key`) + `product_slug` — internal-only, first-party producers | v1 |
| Async, fire-and-forget (202 + queue) for events | v1 |
| Event replay from `event_log` | later |
| Provider inbound webhooks (bounce/complaint) | v1 (email) |

## Subscriber profiles

| Feature | Phase |
|---------|-------|
| Per `(product, external_id)` profile | v1 |
| Arbitrary `attributes` (JSONB) for personalization | v1 |
| `last_seen_at` tracking | v1 |
| Per-subscriber timezone (send-time windows) | later |

## Workflows (declarative, admin-editable)

| Feature | Phase |
|---------|-------|
| Trigger → ordered steps (`send`/`delay`/`cancel_on`/`repeat`) | v1 |
| Versioned definitions; in-flight runs pin their version | v1 |
| Enable/disable per workflow | v1 |
| Admin-editable delays and conditions (no deploy) | v1 |
| `delay: until:<data.field>` (absolute-time scheduling) | v1 |
| Multiple workflows per trigger event | v1 |
| Branching / multi-step sequences beyond linear | later |

## Scheduling (schedule-and-cancel)

| Feature | Phase |
|---------|-------|
| Durable delayed jobs (BullMQ) | v1 |
| Cancellation via counter-events | v1 |
| Re-arming recurring timers (inactivity) | v1 |
| Nightly sweep backstop | v1 |

## Templating & rendering

| Feature | Phase |
|---------|-------|
| Liquid variable interpolation + safe light logic | v1 |
| Per-product branded layout wrapper | v1 |
| Body HTML + structured CTA blocks (label + link) | v1 |
| Declared-variable helper in the editor | v1 |
| Live preview (rendered with sample data) | v1 |
| Send-test to an admin's email | v1 |
| MJML-based responsive layouts | later |

## Delivery & channels

| Feature | Phase |
|---------|-------|
| Email driver over SMTP / Amazon SES | v1 |
| Channel-driver abstraction (pluggable) | v1 |
| Slack / in-app / SMS drivers | later |
| Per-message delivery status tracking | v1 |

## Preferences & compliance

| Feature | Phase |
|---------|-------|
| Per-category, per-channel opt-out (marketing) | v1 |
| Unsubscribe link + auto footer on marketing mail (omitted for transactional) | v1 |
| Suppression list (hard bounces, complaints, unsubscribes) | v1 |
| **Class-aware gate** — transactional bypasses opt-out/unsubscribe/complaint; both honor hard bounce | v1 |
| Preference center page (hosted) | later |

## Admin UI

Single **superadmin** role — full access to every product. No RBAC / per-product admin scoping.

| Feature | Phase |
|---------|-------|
| Products: branding, from/reply-to (no API keys — shared service key) | v1 |
| Workflow editor (trigger, steps, delays, enable) | v1 |
| Template editor (subject, body, CTAs) + preview + send-test | v1 |
| Subscriber lookup (profile, prefs, message history) | v1 |
| Campaigns: one-off marketing blast to a product's subscribers (+ resend) | v1 |
| Message/event logs | v1 |
| Superadmin auth (full access, no roles) | v1 |
| Audit trail of admin edits | v1 |

## Reliability & observability

| Feature | Phase |
|---------|-------|
| Retries with backoff + dead-letter queue | v1 |
| Idempotency at ingest/run/send | v1 |
| Structured logs + metrics (queue depth, send rate, failures) | v1 |
| OpenAPI spec | v1 |
| Plain-HTTP producer clients (no SDK package) | v1 |
| Event replay tooling | later |

## v1 scope summary

**Ship:** email channel, all 6 Creative Studio workflows (including abandoned-checkout), the transactional send API, marketing campaigns (one-off blasts), admin editing, preferences/unsubscribe, and small per-producer HTTP clients (core in TS, studio in Python — no published SDK package).

## Campaigns (one-off marketing blasts)

Beyond event-driven workflows, an admin can send a **campaign** — a single marketing email to a product's whole subscriber base — from the admin UI. Pick a saved marketing template or compose subject/body/CTA inline; the service fans out on a worker, honoring preferences + suppressions per recipient (it's marketing, so it always carries an unsubscribe footer). Each send is idempotent on `(campaign_id, subscriber)`, so **Resend** only mails recipients not yet sent. Per-campaign `sent`/`suppressed`/`failed` counts are shown as fan-out progresses. See the `campaigns` table in [03](03-data-model.md).

**Migration (own phase):** move the platform's existing required/transactional emails (core OTP/reset/invite/contact, studio share/batch, sd-buybox) onto sd-mail-service and retire core's SMTP path — see [13-rollout-phases](13-rollout-phases.md#migration-of-existing-emails).

**Explicitly later:** additional channels, hosted preference center, richer branching workflows.

See the phased plan in [13-rollout-phases](13-rollout-phases.md).
