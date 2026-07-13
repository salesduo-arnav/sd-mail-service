# HTTP Integration Examples (internal, no SDK)

sd-mail-service is an **internal-only** service — trusted first-party producers (core-platform, listings-optimizer, …) integrate over plain HTTP. Auth is the shared **`X-Service-Key`** (= the service's `INTERNAL_API_KEY`); the product is named per request via **`product_slug`**. There are no per-product API keys.

- **Rendered docs (Redoc):** `GET /docs` — e.g. http://localhost:3110/docs
- **Machine-readable spec:** [`../openapi.json`](../openapi.json), also served at `GET /openapi.json`

Base URL: `SD_MAIL_SERVICE_URL` (e.g. `http://localhost:3110`). Every call sends `X-Service-Key: $INTERNAL_API_KEY` (and optionally `X-Service-Name: <your-service>`). Unknown `product_slug` → `404`; missing/wrong key → `401`.

## Emit a lifecycle event (async) → starts/cancels workflows

```bash
curl -X POST "$SD_MAIL_SERVICE_URL/internal/events" \
  -H "X-Service-Key: $INTERNAL_API_KEY" -H "X-Service-Name: sd-core-platform" \
  -H "Content-Type: application/json" \
  -d '{
    "product_slug": "creative-studio",
    "event_key": "trial_started",
    "idempotency_key": "trial:org_1",
    "occurred_at": "2026-07-08T10:00:00Z",
    "subscriber": { "external_id": "org_1", "email": "owner@acme.com", "name": "Jane Doe",
                    "attributes": { "org_name": "Acme", "role": "owner" } },
    "data": { "trial_ends_at": "2026-07-22T10:00:00Z" }
  }'
# → 202 { "id": "...", "deduped": false }
```

Cancel a pending nudge by emitting the counter-event (the workflow's `cancel_on` key):

```bash
curl -X POST "$SD_MAIL_SERVICE_URL/internal/events" \
  -H "X-Service-Key: $INTERNAL_API_KEY" -H "Content-Type: application/json" \
  -d '{ "product_slug": "creative-studio", "event_key": "integration_connected",
        "idempotency_key": "int:org_1", "subscriber": { "external_id": "org_1" } }'
```

Python (`httpx`, studio):

```python
await httpx.AsyncClient().post(
    f"{SD_MAIL_SERVICE_URL}/internal/events",
    headers={"X-Service-Key": INTERNAL_API_KEY, "X-Service-Name": "creatives-micro-tool"},
    json={"product_slug": "creative-studio", "event_key": "generation_completed",
          "idempotency_key": f"gen:{project_id}",
          "subscriber": {"external_id": org_id}, "data": {"kind": "seo"}})
```

## Transactional send (synchronous) → required mail (OTP, reset, invite, share)

Await the result — the user is waiting, or the flow must roll back on failure.

```bash
curl -X POST "$SD_MAIL_SERVICE_URL/internal/messages" \
  -H "X-Service-Key: $INTERNAL_API_KEY" -H "Content-Type: application/json" \
  -d '{ "product_slug": "core-platform", "template_key": "login_otp",
        "to": { "email": "jane@acme.com", "name": "Jane", "external_id": "user_123" },
        "data": { "otp": "123456", "expires_minutes": 5 },
        "idempotency_key": "login_otp:user_123" }'
# → 200 { "message_id": "...", "status": "sent", "provider_message_id": "..." }
# → 422 { "error": "not_delivered", ... }   (hard-bounced address — surface to the user)
```

Signup OTP with **no account yet** — omit `external_id`, send to a raw email:

```bash
curl -X POST "$SD_MAIL_SERVICE_URL/internal/messages" \
  -H "X-Service-Key: $INTERNAL_API_KEY" -H "Content-Type: application/json" \
  -d '{ "product_slug": "core-platform", "template_key": "signup_otp", "to": { "email": "new@acme.com" }, "data": { "otp": "654321" } }'
```

Transactional sends **bypass** preferences + unsubscribe/complaint (a user can't opt out of an OTP); they're blocked only by a prior **hard bounce**, returned as a `422` the caller can surface.

## Pre-rendered relay: `/internal/email/send`

Raw (already-rendered) email for callers that don't use templates. Same `X-Service-Key` + optional `product_slug`; accepts `to` as a string or an array.

```bash
curl -X POST "$SD_MAIL_SERVICE_URL/internal/email/send" \
  -H "X-Service-Key: $INTERNAL_API_KEY" -H "X-Service-Name: sd-buybox" -H "Content-Type: application/json" \
  -d '{ "to": ["a@acme.com","b@acme.com"], "subject": "Buy Box alert", "html": "<p>…</p>", "product_slug": "buybox" }'
```

## Notes

- Always send a reproducible `idempotency_key` — retries are safe (deduped at ingest / transactional replay).
- Emit **facts** (`integration_connected`), not intentions — the service decides what to send, per [ADR-0002](../adr/0002-schedule-and-cancel.md).
- Event keys are referenced by workflows as strings — keep them stable.
