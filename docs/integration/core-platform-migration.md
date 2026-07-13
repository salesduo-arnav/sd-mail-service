# Core-platform email migration — provisioning runbook

core-platform now sends **all** its transactional email through sd-mail-service (SMTP retired, hard cutover — no fallback).

> **One-click provisioning.** The `core-platform` product and its 5 transactional templates are created by the catalog provisioner — click **Provision catalog** in the admin UI → Products (source of truth: `backend/src/provisioning/catalog.ts`). It's idempotent and admin-triggered (nothing auto-seeds on startup), so **you do not need to create the product or author the templates by hand** and a redeploy won't touch your edits. The sections below document what gets provisioned (for reference/editing) and the **core env wiring** (§2) you still have to do before deploying, or its OTP/reset/invite/contact emails will fail.

> **Scope:** this runbook covers core's **own** transactional mail (the `core-platform` product). core-platform is *also* a producer of the **Creative Studio lifecycle events** (`trial_started` / `integration_connected` / `plan_purchased`) — that setup lives in [`creative-studio-migration.md`](creative-studio-migration.md). Both use the same `SD_MAIL_SERVICE_KEY`. Ship sd-mail-service + core-platform (+ creatives) together — they're one atomic change. **To stand up the whole stack and test every flow end-to-end, follow [`run-and-test.md`](run-and-test.md).**

## 1. Create the product

Admin UI (`http://localhost:5180` in dev) → **Products** → New product:
- **Name:** `core-platform` (slug `core-platform` — the client sends `product_slug: core-platform` on every send).
- **From email:** `"SalesDuo" <no-reply@salesduo.com>` (or the real sending identity).
- **Reply-to email:** `support@salesduo.com`.
- **Branding (optional):** brand name `SalesDuo`, brand color `#ff9900` (matches core's current `brand_*` config).

## 2. Wire core's env (no product API key needed)

Core authenticates with the **shared service key** and names the product via `product_slug: core-platform` on each request — no per-product API key to generate. The `core-platform` product just needs to exist (step 1, for branding + templates).

| core env var | value |
|---|---|
| `SD_MAIL_BASE_URL` | sd-mail-service base URL (e.g. `http://localhost:3110`) |
| `SD_MAIL_SERVICE_KEY` | sd-mail-service's `INTERNAL_API_KEY` |

## 3. Author the 5 templates

Templates → New template, **type `transactional`** for all 5. Subjects and bodies are Liquid; variables come from the `data` core sends (available both as `{{ x }}` and `{{ data.x }}`). Reset & invitation use the **CTA** fields for their button (leave the URL as Liquid).

> Bodies below are the wrapped-content only — the product layout adds the header/footer. CTA buttons are configured in the template's CTA fields, not the body.

### `login_otp`
- **Subject:** `Your login code`
- **Body:**
  ```html
  <p>Hi {{ first_name }},</p>
  <p>Your login code is:</p>
  <p style="font-size:28px;font-weight:700;letter-spacing:4px;">{{ otp }}</p>
  <p>It expires in {{ expires_minutes }} minutes. If you didn't request it, you can ignore this email.</p>
  ```

### `signup_otp`
- **Subject:** `Verify your email - {{ brand_name }}`
- **Body:**
  ```html
  <p>Welcome to {{ brand_name }}!</p>
  <p>Use this code to verify your email:</p>
  <p style="font-size:28px;font-weight:700;letter-spacing:4px;">{{ otp }}</p>
  <p>It expires in {{ expires_minutes }} minutes.</p>
  ```

### `password_reset`
- **Subject:** `Reset your password - {{ brand_name }}`
- **Body:**
  ```html
  <p>Hi {{ first_name }},</p>
  <p>We received a request to reset your password. Click the button below to choose a new one.</p>
  <p>This link expires in {{ expires_minutes }} minutes. If you didn't request it, you can safely ignore this email.</p>
  ```
- **CTA primary:** label `Reset Password`, URL `{{ data.reset_url }}`

### `invitation`
- **Subject:** `You've been invited to join {{ org_name }} on {{ brand_name }}`
- **Body:**
  ```html
  <p>You've been invited to join <strong>{{ org_name }}</strong> on {{ brand_name }}.</p>
  <p>Click the button below to accept the invitation and set up your account.</p>
  ```
- **CTA primary:** label `Accept Invitation`, URL `{{ data.invite_url }}`

### `contact_notify`
Internal notification to the support inbox (core sets `to` = support email and `reply_to` = the submitter). User-supplied fields are escaped.
- **Subject:** `[Contact] {{ subject }} — {{ name }}`
- **Body:**
  ```html
  <p><strong>From:</strong> {{ name | escape }} &lt;{{ email | escape }}&gt;</p>
  <p><strong>Category:</strong> {{ category | default: "—" }} · <strong>Source:</strong> {{ source | default: "—" }} · <strong>Org:</strong> {{ org_name | default: "—" }}</p>
  <p><strong>Subject:</strong> {{ subject | escape }}</p>
  <hr/>
  <p>{{ message | escape | newline_to_br }}</p>
  ```

## 4. Verify

With sd-mail-service running (Mailhog for dev), point core at it and drive each flow (see the main plan's verification): each should land in Mailhog with the right subject/link; `contact_notify` should show **Reply-To = the submitter**.

## 5. Data contract (reference)

| Template | `to` | `reply_to` | `data` |
|---|---|---|---|
| `login_otp` | user email | — | `otp`, `expires_minutes` |
| `signup_otp` | raw email | — | `otp`, `expires_minutes` |
| `password_reset` | user email | — | `reset_url`, `expires_minutes` |
| `invitation` | invitee email | — | `org_name`, `invite_url` |
| `contact_notify` | support inbox | submitter email | `name`, `email`, `subject`, `message`, `category`, `source`, `org_name` |
