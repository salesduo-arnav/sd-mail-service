# ADR-0006 — Transactional email + migrating existing mail into the service

**Status:** Accepted

> **Update (internal-only migration):** the endpoints referenced below moved to the internal plane — producers now use the shared service key (`X-Service-Key = INTERNAL_API_KEY`) + `product_slug` on `POST /internal/messages` (transactional) and `POST /internal/events` (async), replacing the product-key `/v1/*` API. The decision itself (two message classes, the exemption rule, no core SMTP fallback) is unchanged.

## Context

sd-mail-service was designed for lifecycle/**marketing** email (event-driven, schedule-and-cancel, unsubscribable). But SalesDuo also sends **required/transactional** email that must never be blocked by an unsubscribe: login OTP, signup OTP, password reset, org invitation (which today even rolls the invite back if the mail fails), plus contact-us, the studio's share invites, and batch-complete. Today these go through core-platform's SMTP (`mail.service.ts`), and studio + sd-buybox have no SMTP of their own — they route through core's `POST /internal/email/send`.

We want sd-mail-service to be the **single email egress** for the platform, including these transactional emails, without letting unsubscribe/suppression block required mail.

## Decision

1. **Two message classes** (`type` on `templates` and `messages`): `marketing` (existing, workflow-driven) and `transactional` (required/1:1).
2. **Synchronous transactional API** `POST /v1/messages` — renders a named template and sends **inline**, returning a delivery result. Can target a **raw email** (signup OTP has no account yet). This is separate from the async `POST /v1/events` pipeline.
3. **Exemption rule:** transactional messages **bypass** preference opt-outs and the `unsubscribe`/`complaint` suppression reasons, still **honor `hard_bounce`**, and carry **no unsubscribe footer / `List-Unsubscribe`**. Marketing keeps full preference + suppression enforcement and the footer.
4. **Full dependency, no core SMTP fallback:** all mail code is removed from core; OTP/reset/invite depend entirely on sd-mail-service.
5. **Migrate everything, phased:** lifecycle first, then the transactional/existing emails, then retire core's `mail.service.ts` / `email-templates.ts` / `email_subject_*` config and `/internal/email/send`; repoint studio + sd-buybox. Producer-built links (reset/invite) are passed as template `data`.

## Consequences

- **+** One place to author, send, log, and comply for *all* platform email; consistent branding + a single delivery/suppression view.
- **+** Unsubscribing from marketing can never block a login code (exemption rule), and callers get success/failure for required mail (sync API).
- **−/risk (accepted):** login/signup availability now depends on sd-mail-service. The **transactional path is availability-critical** and must be treated as such: HA API replicas, a fast in-request timeout + limited retries, provider (SES) redundancy, health checks, and paging alerts. Choosing full dependency (over a break-glass SMTP fallback in core) trades a small resilience buffer for a clean single egress — mitigated by the HA requirements above. See [11](../11-security-and-compliance.md) and [12](../12-observability-and-ops.md).
- **−** Migration touches core auth/invitation/contact call sites, the studio client, and the sd-buybox client; sequenced in [13 Phase 6](../13-rollout-phases.md#migration-of-existing-emails).

Detail: [04](../04-event-and-workflow-model.md#two-ways-to-send-events-marketing-vs-messages-transactional), [11](../11-security-and-compliance.md), [13](../13-rollout-phases.md).
