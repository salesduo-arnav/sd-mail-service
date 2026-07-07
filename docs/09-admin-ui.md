# 09 — Admin UI

sd-mail-service ships its **own** admin app (React), talking to the Admin API. It is where non-engineers control everything that isn't code: workflows, timing, copy, CTAs, branding, and preferences.

There is a **single admin type — superadmin** — with full access to every product. **No RBAC, no per-product roles.** Anyone with a superadmin login can manage all products. (If per-product delegation is ever needed, it can be added later; the v1 model is intentionally simple.)

## Sections

| Section | What admins do |
|---------|----------------|
| **Products** | Create/edit a product; set branding (name, color, logo), `from_email`, `reply_to_email`, and the branded `layout_html`. Manage API keys (create, name, revoke). |
| **Workflows** | List per product. Create/edit a workflow: trigger event key, ordered steps (add `delay` with a duration, `cancel_on` with event keys, `send` with a template), category, audience, enable/disable. Everything is data — **no deploy**. |
| **Templates** | Edit `subject` and `body` (Liquid + HTML), primary/secondary **CTA** blocks (label + link), and the **`type`** — `marketing` (attached to a workflow, gets an unsubscribe footer) or `transactional` (standalone, no workflow, sent via `/v1/messages`, no footer). A variable helper lists available vars (from the workflow for marketing, or the send `data` for transactional). **Live preview** renders with sample data; **Send test** delivers to the admin's own email. |
| **Subscribers** | Look up a subscriber by `external_id`/email; view attributes, `last_seen_at`, preferences, and message history. Manually suppress/unsuppress. |
| **Logs & analytics** | Event stream (ingested events), workflow runs (active/canceled/completed), messages (sent/bounced/failed), suppression list. Filter by product/subscriber/date. |
| **Audit** | Every admin edit (who changed which workflow/template/version, when). |

Because there's no role scoping, all sections list **all products** for every admin; product is a filter, not a permission boundary in the admin UI.

## Workflow editor model

The editor is a thin UI over the [step schema](04-event-and-workflow-model.md#workflow-definition). It never lets an admin write arbitrary code — only pick step types and fill fields:

```
Trigger:  [ creative_studio.trial_started ▾ ]
Steps:
  1. delay      [ 1 ] [ days ▾ ]
  2. cancel on  [ creative_studio.integration.connected  (+) ]
  3. send email [ template: no_integration_1d ▾ ]  audience [ event_subscriber ▾ ]
Category: [ onboarding ▾ ]     Enabled: [x]
```

Saving creates a new `workflow_version`; in-flight runs keep their pinned version.

## Admin authentication

- Admin sessions are separate from product API keys (which are for ingestion only).
- A single **superadmin** role; every Admin API call requires a valid superadmin session, enforced server-side.
- Options: dedicated admin login, or SSO/OIDC against SalesDuo's existing identity. Decided at build time; the `admin_users` table is provider-agnostic and simply lists superadmins.

## Guardrails

- Template save validates Liquid + checks referenced variables against the workflow's declared manifest (warns on unknowns).
- Delay durations validated (`1d`, `48h`, `until:<field>`).
- Disabling a workflow immediately stops future runs and no-ops pending ones at fire time.
- Destructive actions (revoke key, delete workflow) are audited and confirmable.
- All admin edits are recorded (`workflow_versions.created_by` → `admin_users`) for an audit trail.
