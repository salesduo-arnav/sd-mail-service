# 11 — Security & Compliance

## Authentication & authorization

- **Producers** authenticate with a **product-scoped API key** (`Authorization: Bearer` / `X-Api-Key`). Keys are stored **hashed** (`api_keys.key_hash`); plaintext is shown once. Revoke via `revoked_at`. A leaked key's blast radius is a single product.
- Optional **HMAC signing** of event bodies (`X-Signature`) for payload integrity.
- **Admins** are **superadmins** — a single admin type with full access to all products (no RBAC). They authenticate with separate sessions (login or SSO/OIDC); every Admin API call requires a valid superadmin session — see [09](09-admin-ui.md).
- **Tenancy isolation:** every table is scoped by `product_id`; no cross-product reads. This is enforced in the data-access layer, not just the UI.

## Trust boundary

sd-mail-service does **not** authenticate end users. It trusts that a valid product API key implies the `external_id`, `email`, and `attributes` in an event are correct. Producers are responsible for sending accurate identities. This is the same trust model as core-platform's internal service API (`X-Service-Key`).

## PII handling

- Stored PII: `subscribers.email`, `subscribers.name`, `subscribers.attributes`, and rendered content in `messages`/`event_log.data`.
- **Encryption:** TLS in transit; encryption at rest on RDS; consider column/field encryption for `email`/`attributes` if policy requires.
- **GDPR / deletion:** support subscriber delete by `(product, external_id)` → remove profile + preferences; retain a **hashed** suppression tombstone if needed to honor prior unsubscribes.
- **Retention:** `event_log` and `messages` are pruned on a policy (e.g. raw payloads 90 days, aggregate counts retained). Documented in [12](12-observability-and-ops.md).

## Email compliance (CAN-SPAM / GDPR / CASL)

- **Unsubscribe:** every **non-transactional** email carries a one-click unsubscribe link (signed token, scoped to subscriber + category) and a `List-Unsubscribe` header. Clicking records a preference/suppression; enforcement is at **send time**.
- **Suppression list:** hard bounces, complaints (FBL), and unsubscribes are added to `suppressions`; blocked before non-transactional sends.
- **Transactional vs marketing:** workflows carry a `category`. Transactional categories (e.g. password reset, if migrated later) may bypass marketing unsubscribe but still respect hard-bounce suppression. Lifecycle nudges (onboarding/reengagement/billing) are treated as marketing → fully unsubscribable.
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
- Signing secrets rotatable; API keys rotatable per product.

## Threats & mitigations (summary)

| Threat | Mitigation |
|--------|------------|
| Leaked product key | Hashed storage, revoke, product-scoped blast radius |
| Cross-tenant access | `product_id` scoping enforced server-side |
| Payload tampering | Optional HMAC signing |
| Spam complaints / poor deliverability | Suppression list, domain auth, one-click unsubscribe, category prefs |
| PII exposure | Encryption, retention limits, GDPR delete |
| Unsubscribe forgery | Signed, scoped, expiring tokens |
| Replay of old events | Idempotency keys; `occurred_at` sanity checks |
