# HTTP Integration Examples (no SDK)

Producers integrate with **plain HTTP** — no client library. Get a product API key from the admin UI, then call the REST endpoints below.

- **Rendered docs (Redoc):** `GET /docs` — e.g. http://localhost:3110/docs
- **Machine-readable spec:** [`../openapi.json`](../openapi.json), also served at `GET /openapi.json`

Base URL: `SD_MAIL_SERVICE_URL` (e.g. `https://mail.salesduo.com`). Auth: `Authorization: Bearer <API_KEY>` or `X-Api-Key: <API_KEY>`.

## Emit a lifecycle event (async, fire-and-forget) → starts/cancels workflows

```bash
curl -X POST "$SD_MAIL_SERVICE_URL/v1/events" \
  -H "Authorization: Bearer $SD_MAIL_SERVICE_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "event_key": "creative_studio.trial_started",
    "idempotency_key": "trial:user_123:2026-07-08",
    "occurred_at": "2026-07-08T10:00:00Z",
    "subscriber": { "external_id": "user_123", "email": "jane@acme.com", "name": "Jane Doe",
                    "attributes": { "org_id": "org_1", "org_name": "Acme", "role": "owner" } },
    "data": { "trial_ends_at": "2026-07-22T10:00:00Z", "start_link": "https://app/start" }
  }'
# → 202 { "id": "...", "deduped": false }
```

Cancel a pending nudge by emitting the counter-event (the workflow's `cancel_on` key):

```bash
curl -X POST "$SD_MAIL_SERVICE_URL/v1/events" \
  -H "Authorization: Bearer $SD_MAIL_SERVICE_API_KEY" -H "Content-Type: application/json" \
  -d '{ "event_key": "creative_studio.integration.connected",
        "idempotency_key": "int:user_123", "subscriber": { "external_id": "user_123" } }'
```

TypeScript (`fetch`) at an existing lifecycle hook:

```ts
await fetch(`${process.env.SD_MAIL_SERVICE_URL}/v1/events`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.SD_MAIL_SERVICE_API_KEY}` },
  body: JSON.stringify({ event_key: 'creative_studio.trial_started', idempotency_key: `trial:${user.id}`,
    subscriber: { external_id: user.id, email: user.email, name: user.full_name }, data: { trial_ends_at } }),
}).catch((e) => log.warn('mail emit failed', e)); // fire-and-forget
```

Python (`httpx`, studio) after `CreditGuard.commit()`:

```python
await httpx.AsyncClient().post(
    f"{SD_MAIL_SERVICE_URL}/v1/events",
    headers={"Authorization": f"Bearer {SD_MAIL_SERVICE_API_KEY}"},
    json={"event_key": "creative_studio.generation.completed",
          "idempotency_key": f"gen:{project_id}:{run_id}",
          "subscriber": {"external_id": user["id"], "email": user["email"]},
          "data": {"asin": asin}})
```

## Activity ping (bumps last_seen_at)

```bash
curl -X POST "$SD_MAIL_SERVICE_URL/v1/events/activity" \
  -H "Authorization: Bearer $SD_MAIL_SERVICE_API_KEY" -H "Content-Type: application/json" \
  -d '{ "external_id": "user_123" }'
```

## Transactional send (synchronous) → required mail (OTP, reset, invite, share)

Await the result — the user is waiting, or the flow must roll back on failure.

```bash
curl -X POST "$SD_MAIL_SERVICE_URL/v1/messages" \
  -H "Authorization: Bearer $SD_MAIL_SERVICE_API_KEY" -H "Content-Type: application/json" \
  -d '{ "template_key": "login_otp",
        "to": { "email": "jane@acme.com", "name": "Jane", "external_id": "user_123" },
        "data": { "otp": "123456", "expires_minutes": 5 },
        "idempotency_key": "login_otp:user_123:2026-07-08T10:00:00Z" }'
# → 200 { "message_id": "...", "status": "sent", "provider_message_id": "..." }
# → 422 { "error": "not_delivered", ... }   (e.g. hard-bounced address — surface to the user)
```

Signup OTP with **no account yet** — omit `external_id`, send to a raw email:

```bash
curl -X POST "$SD_MAIL_SERVICE_URL/v1/messages" \
  -H "Authorization: Bearer $SD_MAIL_SERVICE_API_KEY" -H "Content-Type: application/json" \
  -d '{ "template_key": "signup_otp", "to": { "email": "new@acme.com" }, "data": { "otp": "654321" } }'
```

Transactional sends **bypass** preferences + unsubscribe/complaint (a user can't opt out of an OTP); they're blocked only by a prior **hard bounce**, returned as a `422` the caller can surface.

## Forward-compat: `/internal/email/send` (Phase 6 migration)

So studio (`SdInfraClient.send_email`) and sd-buybox can repoint by changing only the base URL. Auth is the shared `X-Service-Key` (not a product key). Accepts `to` as a string or an array.

```bash
curl -X POST "$SD_MAIL_SERVICE_URL/internal/email/send" \
  -H "X-Service-Key: $INTERNAL_API_KEY" -H "X-Service-Name: sd-buybox" -H "Content-Type: application/json" \
  -d '{ "to": ["a@acme.com","b@acme.com"], "subject": "Buy Box alert", "html": "<p>…</p>", "product_slug": "buybox" }'
```

## Notes

- Always send a reproducible `idempotency_key` — retries are safe (deduped at ingest / transactional replay).
- Emit **facts** (`integration.connected`), not intentions — the service decides what to send, per [ADR-0002](../adr/0002-schedule-and-cancel.md).
- Event keys are namespaced `"<product>.<event>"` and referenced by workflows as strings — keep them stable.
