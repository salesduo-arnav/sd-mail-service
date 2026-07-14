# 11 — Security & Compliance

## Authentication & authorization

- **Producers** authenticate with the shared **service key** (`X-Service-Key` = `INTERNAL_API_KEY`) on `/internal/*`, and name the product per request via `product_slug`. This is an **internal-only** service (trusted first-party producers only) — there are **no per-product API keys**. Rotating the shared key cuts off all producers at once; the blast radius of a leaked key is "everything a producer can do," which is why the service is never exposed publicly.
- **Admins** are **superadmins** — a single admin type with full access to all products (no RBAC). They authenticate with separate sessions (login or SSO/OIDC); every Admin API call requires a valid superadmin session — see [09](09-admin-ui.md).
- **Tenancy isolation:** every table is scoped by `product_id`; no cross-product reads. This is enforced in the data-access layer, not just the UI.

## Trust boundary

sd-mail-service does **not** authenticate end users. It trusts that a producer holding the shared service key sends correct `external_id`, `email`, and `attributes`. Producers are responsible for accurate identities — the same trust model as core-platform's other internal `X-Service-Key` APIs.

## PII handling

- Stored PII: `subscribers.email`, `subscribers.name`, `subscribers.attributes`, and rendered content in `messages`/`event_log.data`.
- **Encryption:** TLS in transit; encryption at rest on RDS; consider column/field encryption for `email`/`attributes` if policy requires.
- **GDPR / deletion:** support subscriber delete by `(product, external_id)` → remove profile + preferences; retain a **hashed** suppression tombstone if needed to honor prior unsubscribes.
- **Retention:** `event_log` and `messages` are pruned on a policy (e.g. raw payloads 90 days, aggregate counts retained). Documented in [12](12-observability-and-ops.md).

## Email compliance (CAN-SPAM / GDPR / CASL)

- **Two message classes** (`messages.type`, `templates.type`):
  - **marketing** — lifecycle/nudge mail (workflow-driven). Carries a one-click unsubscribe link (signed token scoped to subscriber + category) + `List-Unsubscribe`; blocked by preference opt-out **and any** suppression (unsubscribe, complaint, hard bounce). Fully unsubscribable.
  - **transactional** — required/1:1 mail (OTP, password reset, invitation, contact, share). Sent via the synchronous `/internal/messages` API. **Bypasses** preference opt-outs and unsubscribe/complaint suppression — a user must never lose access to required mail by unsubscribing or marking a prior email as spam. Blocked **only** by **hard bounce** (the address is undeliverable). **No** unsubscribe footer/`List-Unsubscribe` (a support contact line instead). This is CAN-SPAM-compliant: transactional/relationship messages are exempt from the unsubscribe requirement.
- **The rule, precisely:** at send time the gate reads `type`. `marketing` → check preferences + all suppression reasons. `transactional` → ignore preferences and the `unsubscribe`/`complaint`/`manual` suppression reasons; honor only `hard_bounce`.
- **Suppression list:** hard bounces, complaints (FBL), and unsubscribes are added to `suppressions` with a `reason`; the reason is what makes the class-aware gate possible.
- **Sender identity:** valid `from`/`reply_to`, physical postal address in footer (CAN-SPAM), truthful subject lines. Domain auth: SPF, DKIM, DMARC.
- **Preferences:** per `(category, channel)` opt-out lets users mute "re-engagement" without losing "billing," etc.

## Unsubscribe token

- Signed (HMAC) payload: `{ subscriber_id, category, exp }`.
- Verified server-side; tampered/expired tokens rejected.
- Landing action: flip `subscriber_preferences` and/or add a `suppression`; show a confirmation (and optional preference center later).

## Abuse & rate limiting

- Per-product ingestion rate limits protect the pipeline.
- Payload size caps on events.
- Admin actions and destructive operations are audited.

## Secrets & config

- SMTP/SES creds, HMAC secrets, DB/Redis URLs via environment/secret manager — never in code or the DB.
- Signing secrets (session/unsubscribe) and the shared `INTERNAL_API_KEY` are rotatable; rotating the shared key cuts off all producers at once (internal-only, never public).

## Threats & mitigations (summary)

| Threat | Mitigation |
|--------|------------|
| Leaked service key | Rotate `INTERNAL_API_KEY`; internal-only (never public) |
| Cross-tenant access | `product_id` scoping enforced server-side |
| Payload tampering | TLS in transit + trusted internal network (shared service key) |
| Spam complaints / poor deliverability | Suppression list, domain auth, one-click unsubscribe, category prefs |
| PII exposure | Encryption, retention limits, GDPR delete |
| Unsubscribe forgery | Signed, scoped, expiring tokens |
| Replay of old events | Idempotency keys; `occurred_at` sanity checks |
| **Required mail unavailable** (login/signup depend on transactional sends — no core SMTP fallback) | Treat the transactional path as **availability-critical**: HA API replicas, fast in-request timeout + limited retries, provider (SES) redundancy, health checks + paging. See [ADR-0006](adr/0006-transactional-and-migration.md) and [12](12-observability-and-ops.md). |
