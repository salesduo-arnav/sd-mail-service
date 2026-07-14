# Creative Studio provisioning runbook

Creative Studio (the `sd-listings-optimizer` "creatives" tool) integrates with sd-mail-service **directly** — its share/batch emails go through `/internal/messages` (no longer relayed via core-platform), and its lifecycle nudges are driven by **events**.

> **One-click provisioning.** The `creative-studio` product, its templates, and its workflows are created by the catalog provisioner — click **Provision catalog** in the admin UI → Products (source of truth: `backend/src/provisioning/catalog.ts`). It's idempotent and admin-triggered (nothing auto-seeds on startup), so **you do not need to author any of the below by hand** and a redeploy won't touch your edits. The sections that follow document what gets provisioned (for reference/editing) and, importantly, the **producer env wiring** (§2) and the **core `required_integrations` config** you still have to do. **For the full stand-up + test-everything walkthrough, see [`run-and-test.md`](run-and-test.md).** Ship sd-mail-service + core + creatives together (one atomic change).

The six lifecycle scenarios and their seed copy are in [`../07-creative-studio-example.md`](../07-creative-studio-example.md) — use it as the source of truth for the marketing **templates** (subjects/bodies/CTAs). This runbook uses the **implemented** event model, which differs from that doc's illustrative event names in two ways:

- **Fact-named events, not `creative_studio.*`.** The events are core/tool **facts** (`trial_started`, `integration_connected`, `plan_purchased`, `generation_completed`, `activity`). The *product* (this `creative-studio` product) supplies the tool context — the events are not labelled "studio". core-platform is a generic *producer* that routes each fact to the tool product(s) it concerns.
- **The subscriber is the ORGANIZATION** (`external_id = org_id`). Both producers (core for billing/integration, the optimizer for generation/activity) always have `org_id`, so triggers and cancels correlate without any user matching. The contact email/name is the org owner's (set by core's events); the optimizer's events are "thin" (org_id only) so they never overwrite it.

## Producers & events

| Event | Produced by | When | Subscriber |
|---|---|---|---|
| `trial_started` | core-platform | trial begins (Stripe → TRIALING), routed to the plan's tool product | org (owner as contact) |
| `integration_connected` | core-platform | the org has connected a tool's **required** integrations (`Tool.required_integrations`); fans out per tool | org |
| `plan_purchased` | core-platform | transition into ACTIVE, routed to the plan's tool product | org |
| `trial_ended` | core-platform | a trial ended **without** converting (auto period-end OR manual cancel — the subscription-deleted webhook), routed to the plan's tool product | org |
| `generation_completed` | creatives | creative project finalize + SEO bulk dispatch | org (thin) |
| `activity` | creatives | any authenticated org request (throttled once/org/day) | org (thin) |
| `checkout.initiated` / `.completed` | core-platform | plan checkout created / completed (Stripe) | org |

> **Required integrations (must configure in core):** `integration_connected` fires for a tool only once the org has connected that tool's `Tool.required_integrations`. **In core, set the `creative-studio` tool's `required_integrations` to `['sp_api']`** (`sp_api` = Seller **or** Vendor Central) — via the core admin Tools screen or `PATCH /admin/tools/:id { required_integrations: ['sp_api'] }`. If it's empty, `integration_connected` never fires and the no-integration nudge can't be satisfied. Connecting an integration the tool doesn't need won't cancel the nudge; if the requirement is already met at trial start, core emits `integration_connected` immediately.
>
> **Multi-tool note:** `trial_started`/`plan_purchased` are per-plan (one tool product); `integration_connected` fans out to each tool whose requirement the org now meets.

## 1. Create the product

Admin UI → **Products** → New:
- **Name:** `Creative Studio` (slug `creative-studio`).
- **From email:** `"SalesDuo AI Creative Studio" <no-reply@salesduo.com>`.
- **Reply-to email:** `support@salesduo.com`.
- **Branding:** brand name `SalesDuo AI Creative Studio`, brand color `#EA580C`, logo.

## 2. Wire producer env (no product API key needed)

Producers authenticate with the **shared service key** (`SD_MAIL_SERVICE_KEY` = the service's `INTERNAL_API_KEY`) and name the product via `product_slug: creative-studio` on each request. **No per-product API key is generated** — the product just needs to exist (step 1, for branding + templates).

| Service | Env var | Value |
|---|---|---|
| creatives (`sd-listings-optimizer`) | `SD_MAIL_SERVICE_KEY` | the service's `INTERNAL_API_KEY` |
| creatives | `SD_MAIL_URL` | sd-mail-service base URL (`http://localhost:3110` dev) |
| core-platform | `SD_MAIL_SERVICE_KEY` | the **same** `INTERNAL_API_KEY` |

> core-platform's `mail-lifecycle` registry maps `tool slug → product slug`; adding another tool's lifecycle later = one registry line + that tool's own product (no new key). All producers emit under the one shared key, scoped per request by `product_slug`.

## 3. Author the 4 transactional templates (type `transactional`)

Migrated from the creatives inline HTML. Bodies are wrapped-content (the product layout adds header/footer); CTA buttons via the template CTA fields. Variables available as `{{ x }}` and `{{ data.x }}`.

### `project_shared`
- **Subject:** `{{ sharer_name }} shared a project with you`
- **Body:** `<p><strong>{{ sharer_name }}</strong> has given you <strong>{{ role }}</strong> access to the project <strong>{{ project_name }}</strong> on SalesDuo AI Creative Studio.</p>`
- **CTA primary:** `Open Project` → `{{ data.project_url }}`
- **`data`:** `sharer_name`, `project_name`, `role`, `project_url`

### `seo_project_shared`
- **Subject:** `{{ sharer_name }} shared an SEO project with you`
- **Body:** `<p><strong>{{ sharer_name }}</strong> has given you <strong>{{ role }}</strong> access to the SEO project <strong>{{ project_name }}</strong> on SalesDuo AI Creative Studio.</p>`
- **CTA primary:** `Open SEO Project` → `{{ data.project_url }}`
- **`data`:** `sharer_name`, `project_name`, `role`, `project_url`

### `batch_shared`
- **Subject:** `{{ sharer_name }} shared a batch with you`
- **Body:** `<p><strong>{{ sharer_name }}</strong> has given you <strong>{{ role }}</strong> access to the batch <strong>{{ project_name }}</strong> on SalesDuo AI Creative Studio.</p>`
- **CTA primary:** `Open Batch` → `{{ data.project_url }}`
- **`data`:** `sharer_name`, `project_name`, `role`, `project_url`

### `batch_complete`
- **Subject:** `Your batch creative generation is complete`
- **Body:**
  ```html
  <p>Your batch creative generation job has finished processing.</p>
  <p><strong>Total ASINs:</strong> {{ total }} · <strong>Completed:</strong> {{ completed }} · <strong>Failed:</strong> {{ failed }}</p>
  <p>Your results are ready to download. This link expires in 7 days.</p>
  ```
- **CTA primary:** `Download Results (.zip)` → `{{ data.download_url }}`
- **`data`:** `total`, `completed`, `failed`, `download_url`

## 4. Author the 6 marketing templates (type `marketing`)

Keys, subjects, bodies and CTAs are in [`../07-creative-studio-example.md`](../07-creative-studio-example.md) §1–6: `welcome`, `no_integration_1d`, `no_generation_2d`, `trial_ended`, `inactive_14d`, and `abandoned_checkout_1d`. Author each with that seed copy. (Ignore the `creative_studio.*` event names in that doc — use the fact-named triggers in §5 below.)

**CTA links are literal URLs, entered directly in each template's CTA fields** (e.g. `https://creatives.salesduo.com/app/optimize`, the tutorial URL, `https://app.salesduo.com/billing`) — NOT `{{ data.* }}`. They're static per environment, so this dev product uses dev URLs and prod uses prod URLs. The lifecycle nudges carry no dynamic template data — the tool context comes from the `product_slug`.

## 5. Author the 6 workflows

Workflows → New, under `creative-studio`, using **fact-named** trigger/cancel keys. Audience `event_subscriber` throughout (the subscriber *is* the org/owner).

| Workflow key | Trigger | Steps | Enabled |
|---|---|---|---|
| `welcome` | `trial_started` | `send welcome` | ✅ |
| `no_integration_1d` | `trial_started` | `delay 1d` → `cancel_on [integration_connected]` → `send` | ✅ |
| `no_generation_2d` | `integration_connected` | `delay 2d` → `cancel_on [generation_completed]` → `send` | ✅ |
| `trial_ended` | `trial_ended` | `send` (event-driven — core emits `trial_ended` when the trial actually ends; no timer/cancel) | ✅ |
| `inactive_14d` | `activity` | `delay 14d` → `cancel_on [activity]` → `send` → `repeat` | ✅ |
| `abandoned_checkout_1d` | `checkout.initiated` | `delay 1d` → `cancel_on [checkout.completed]` → `send` | ✅ |

## 6. Data contract (reference)

| Event | subscriber.external_id | subscriber contact | data |
|---|---|---|---|
| `trial_started` | org_id | owner email/name | `trial_ends_at` (ISO; still sent, no longer consumed since `trial_ended` is event-driven) |
| `integration_connected` | org_id | owner email/name | — |
| `plan_purchased` | org_id | owner email/name | `plan_name` |
| `trial_ended` | org_id | owner email/name | — |
| `generation_completed` | org_id | — (thin) | `project_id`, `kind` (`seo` for SEO) |
| `activity` | org_id | — (thin) | — |

## 7. Verify (dev, Mailhog)

With sd-mail-service running (Mailhog UI `:8026`):
1. **Transactional:** share a creative/SEO/batch project and finish a batch generation from creatives → 4 emails land in Mailhog with the right subjects/links.
2. **Onboarding:** emit `trial_started` (drive a trial in core, or `curl /internal/events` per [`http-examples.md`](http-examples.md), subscriber `external_id = <org_id>`) → `welcome` lands immediately; `no_integration_1d` scheduled (inspect **Subscribers → Runs**). `trial_ended` is separate — it fires when core emits the `trial_ended` fact (cancel a trial to trigger it).
3. **Cancel:** connect the tool's **required** integration (Seller/Vendor Central for creative-studio) before +1d → `no_integration_1d` canceled and `no_generation_2d` starts; connecting only a non-required integration (e.g. Ads) does **not** cancel it. Then do a generation → `no_generation_2d` canceled.
4. **Inactivity:** two requests same day → one `activity` event ingested (throttle); the 14d timer re-arms.
5. Replay any event with the same `idempotency_key` → `deduped: true`, no duplicate send.
