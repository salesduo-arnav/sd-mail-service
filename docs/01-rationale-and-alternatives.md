# 01 — Rationale & Alternatives

This document explains **why** sd-mail-service is shaped the way it is. Each major decision also has a short [ADR](adr/).

## Why a separate service (not "email inside core-platform")

An earlier draft embedded a lifecycle-email engine *inside* core-platform, reading its `Subscription`, `IntegrationAccount`, and `credit_ledger` tables directly. That works only for products that live in core's database. It breaks the moment a consumer is **outside** the micro-tool system.

We are explicitly targeting consumers that are **not** part of core-platform: a future **early-reviews** platform and an **affiliates** platform, each with its own datastore, plus core-platform and the studio. A shared capability that every one of them needs — reliable, scheduled, admin-editable, compliant email — should be a **service**, not a library baked into one product.

Concrete reasons:

- **Reuse across unlike products.** One integration contract (emit an event) works for any platform, in any language, regardless of its data model.
- **No coupling to any product's DB.** The service can't reach into `Subscription`/`IntegrationAccount`; instead products emit events. This keeps every consumer independent and lets sd-mail-service evolve without migrations rippling across products.
- **Independent scaling & deploy.** Email bursts, provider retries, and long-lived delayed jobs scale on their own cadence, separate from any product's web tier.
- **Single compliance surface.** Unsubscribe, suppression, CAN-SPAM footers, and preference management live in exactly one place, applied uniformly — instead of each product re-implementing (and mis-implementing) them.
- **One place to reason about timing.** "After 1 day / 2 days / 2 weeks" logic is centralized, durable, and observable, rather than scattered across products that mostly have no scheduler at all (the studio has no cron/beat today).

Trade-off accepted: an extra service to run, and producers must emit events. We consider this worth it for a cross-cutting concern used by 4+ platforms. → [ADR-0001](adr/0001-separate-service.md)

## Build in-house vs adopt

| Option | Pros | Cons | Verdict |
|--------|------|------|---------|
| **Build in-house** (chosen) | Full control; fits our auth/infra/event vocabulary; no external platform to bend or operate; small surface tailored to our needs | Upfront engineering | ✅ Chosen — [ADR-0005](adr/0005-build-in-house.md) |
| Self-host OSS (Novu/Knock-style) | Rich features fast (template editor, workflows, multi-channel, dedup) | Large dependency to learn/operate; must bend its model to ours; upgrade treadmill | ❌ Heavier than our scope needs |
| Thin service over SaaS (Customer.io/SendGrid) | Least infra | Ongoing cost; PII leaves our systems; less long-term control | ❌ Data-residency & control concerns |

The scope we need (a handful of event types, declarative workflows, email first) is small enough that building is cheaper long-term than operating and constraining a general-purpose platform.

## Schedule-and-cancel vs the alternatives (the timing model)

The service doesn't own product state, so "send after 1 day **if** still un-integrated" needs a decoupled mechanism.

| Model | How it works | Why not |
|-------|--------------|---------|
| **Schedule-and-cancel** (chosen) | On the trigger event, schedule a delayed send; a later counter-event cancels it; if still pending at the deadline, send | ✅ Fully decoupled; producers just emit events — [ADR-0002](adr/0002-schedule-and-cancel.md) |
| Callback to producer | At the deadline, call the product's API to ask "is this still true?" | Couples sd-mail-service to every producer's API + auth; N integrations to maintain |
| Producer-decides | Products run their own timers and emit "send nudge N now" | Pushes scheduling back into every product — the exact thing we're centralizing |

Schedule-and-cancel is the standard decoupled pattern (it's how Knock/Novu delay-steps + cancellation keys work) and it keeps producers trivially simple.

## Stateful subscriber profiles vs stateless

| Model | Pros | Cons | Verdict |
|-------|------|------|---------|
| **Subscriber profiles** (chosen) | Enables inactivity nudges (`last_seen_at`), preferences, thin events; single source of recipient truth | Small store to maintain | ✅ — [ADR-0004](adr/0004-subscriber-profiles.md) |
| Stateless (event carries all) | No recipient storage | Inactivity/preferences impossible without pushing state back to producers; heavy events | ❌ Blocks email #6 (2-week inactivity) and compliance |

## Declarative workflows vs code

| Model | Pros | Cons | Verdict |
|-------|------|------|---------|
| **Declarative workflows as data** (chosen) | Admins add/tune campaigns with no deploy; safe (no arbitrary code); versioned | Need a small, well-defined step schema | ✅ — [ADR-0003](adr/0003-declarative-workflows.md) |
| Code-defined workflows | Type-safe, powerful | Every new campaign/product flow is an engineering change + deploy | ❌ Doesn't scale across products/admins |

Workflows are **structured data** (trigger → ordered steps of `send`/`delay`/`cancel_on`/`repeat`), not a Turing-complete DSL. This gives non-engineers control without the risk of arbitrary logic.

## Non-goals

sd-mail-service is deliberately **not**:

- **A CRM / customer data platform.** It stores only what's needed to send and comply. Products remain the system of record.
- **A batch campaign blaster / newsletter tool.** It is event-driven lifecycle messaging, not "email this segment on Tuesday." (A future admin-triggered broadcast could be layered on, but it's out of scope for v1.)
- **An analytics warehouse.** It logs deliveries and events for operational purposes; deep product analytics belong elsewhere (e.g. Mixpanel, already in core).
- **A general workflow/automation engine.** The step vocabulary is intentionally small and messaging-specific.
- **An identity provider.** It trusts the `external_id` and contact info products send; it does not authenticate end users.

## Summary

A separate, in-house, event-driven service with subscriber profiles, declarative workflows, and schedule-and-cancel timing gives us **one reusable, compliant, admin-controlled** way for *any* SalesDuo platform to talk to its users — without coupling to any product's database. Continue to [02-architecture](02-architecture.md).
