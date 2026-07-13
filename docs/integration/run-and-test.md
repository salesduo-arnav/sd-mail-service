# Run & test end-to-end (local)

The single walkthrough to stand up **sd-mail-service + core-platform + listings-optimizer** locally and exercise **every** email flow, grouped by product. Provisioning details live in the two migration runbooks; this ties them together and adds a per-product test matrix. Everything lands in **Mailhog** — nothing leaves the machine.

## 0. Start sd-mail-service (+ Mailhog)

From `sd-mail-service/`:

```bash
make up            # api + worker + scheduler + postgres + redis + mailhog (Docker)
make seed-docker   # bootstrap the superadmin (once)
make urls
```

- **Admin UI:** http://localhost:5180 — `admin@salesduo.com` / `admin12345`
- **API health:** http://localhost:3110/health
- **Mailhog** (captures all dev email): http://localhost:8026

Host-mode alternative: `make setup && make infra`, then `make dev-api`, `make dev-worker`, `make dev-scheduler`, `make admin` in separate terminals.

## 1. Provision the two products (one click in the admin)

Provisioning is a **deliberate, admin-triggered action** — nothing is auto-seeded on startup, so a redeploy never re-creates anything. In the **admin UI → Products**, click **"Provision catalog"**. It idempotently creates:

- **`core-platform`** product + **5** transactional templates
- **`creative-studio`** product + **4** transactional + **6** marketing templates + **6** workflows

It's safe to click repeatedly — existing rows are left untouched (your edits survive). The catalog source of truth is `backend/src/provisioning/catalog.ts`; the two migration runbooks ([`core-platform-migration.md`](core-platform-migration.md), [`creative-studio-migration.md`](creative-studio-migration.md)) document the same content and the producer env wiring.

Then in **core** (needed for the studio no-integration nudge): set the `creative-studio` tool's `required_integrations = ['sp_api']` (admin Tools screen or `PATCH /admin/tools/:id`).

Sanity check the ingest path: `make smoke` → expects **202** (`404` = the `creative-studio` product isn't created yet; `401` = key mismatch).

## 2. Point the producers at sd-mail + start them

All three share **one key**. In dev every `.env` already has `dev-internal-api-key-change-me`, so no editing is needed unless you rotated it. `SD_MAIL_SERVICE_KEY` (core + creatives) must equal sd-mail's `INTERNAL_API_KEY`.

| Producer | env (already set in dev `.env`) | start |
|---|---|---|
| core-platform | `SD_MAIL_BASE_URL=http://host.docker.internal:3110` · `SD_MAIL_SERVICE_KEY=<INTERNAL_API_KEY>` | `make dev` (repo root) |
| listings-optimizer | `SD_MAIL_URL=http://host.docker.internal:3110` · `SD_MAIL_SERVICE_KEY=<INTERNAL_API_KEY>` | `docker compose up -d` (repo root) |

## 3. Test matrix — organized by product

### Product `core-platform` — transactional (5)
Drive from the core app/API; each awaited send lands in Mailhog.

| Flow | Trigger | Template | Expect |
|---|---|---|---|
| Login OTP | request a login OTP | `login_otp` | code email |
| Signup OTP | sign up with a new email | `signup_otp` | verify-email code (no account yet) |
| Password reset | forgot-password | `password_reset` | reset link (CTA button) |
| Invitation | invite a user to an org | `invitation` | accept-invite link; invite rolls back if send fails |
| Contact-us | submit the contact form | `contact_notify` | to the support inbox, **Reply-To = the submitter** |

### Product `creative-studio` — transactional (4)
Drive from the creatives app (share = fire-and-forget; batch-complete = inline in Celery).

| Flow | Trigger | Template |
|---|---|---|
| Share creative project | share a project with a teammate | `project_shared` |
| Share SEO project | share an SEO project | `seo_project_shared` |
| Share batch | share a batch project | `batch_shared` |
| Batch complete | run a batch generation to completion | `batch_complete` (download link) |

### Product `creative-studio` — lifecycle workflows (6, event-driven)
Scheduled with delays — see **Testing delays** to avoid waiting days. Emitter in parentheses.

| Workflow | Trigger event (producer) | Cancel event (producer) |
|---|---|---|
| `welcome` (immediate) | `trial_started` (core — start a trial) | — |
| `no_integration_1d` | `trial_started` (core) | `integration_connected` (core — connect Seller/Vendor Central) |
| `no_generation_2d` | `integration_connected` (core) | `generation_completed` (creatives — run a generation) |
| `trial_ended` (immediate) | `trial_ended` (core — a trial ends without converting; cancel a trial) | — (event-driven, no cancel) |
| `inactive_14d` | `activity` (creatives — any authed request) | `activity` (re-arms) |
| `abandoned_checkout_1d` | `checkout.initiated` (core) | Phase 2 — **deferred** |

> Producer split: **core** emits `trial_started` / `integration_connected` / `plan_purchased` / `trial_ended`; **creatives** emits `generation_completed` / `activity`. All are org-keyed (`external_id = org_id`).

## Testing delays (don't wait days)

Delays are `1d` / `2d` / `14d` (the `welcome` and `trial_ended` sends are immediate — no delay). To test quickly:

- **Cancellation logic (no wait):** emit the trigger, then the cancel event, and check **Admin → Subscribers → the org → Runs** shows the run `canceled`. This proves schedule-and-cancel without waiting for a send.
- **The send actually firing:** temporarily edit the workflow's `delay` to `1m` (this saves a new version — in-flight runs keep their old version, so re-trigger *after* editing). `trial_ended` needs no timer trick — just emit the `trial_ended` event (or cancel a real trial).
- **Inactivity:** `inactive_14d` also has a nightly sweep; for a quick check shorten its delay to `1m`, emit `activity`, then stay quiet.
- Watch scheduled/canceled runs and delivered mail in **Admin → Logs → Runs / Messages** and Mailhog.

## Idempotency
Re-emit any event (or re-send any message) with the same `idempotency_key` → `deduped: true` / no second email.

## Driving flows without the apps
[`http-examples.md`](http-examples.md) has `curl` for `/internal/events` and `/internal/messages` (`X-Service-Key` + `product_slug`) — handy to trigger any event or send directly.
