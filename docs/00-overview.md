# 00 — Overview

## What sd-mail-service is

`sd-mail-service` is a **shared notification service**. Products send it **events** ("a user started a trial", "an integration was connected", "a generation completed"); sd-mail-service decides **which emails to send, to whom, and when** — including emails that should fire *later* and only *if a condition still holds* ("nudge them after 1 day **if** they haven't connected their account yet").

It is a small, internally-owned equivalent of [Knock](https://knock.app) / [Novu](https://novu.co) / Customer.io, scoped to SalesDuo's needs.

## The core shift

**Before:** email lived *inside* core-platform. Each product either called core's `/internal/email/send` with fully-rendered HTML, or built its own inline templates. Timing/conditions ("after 1 day, if no integration") had nowhere to live, and every product would reinvent scheduling.

**After:** email is a *product* of its own. Products stop knowing about SMTP, templates, or timing. They emit **events** and move on.

```
BEFORE                                   AFTER
product ── renders HTML ──▶ core SMTP     product ── emits event ──▶ sd-mail-service ──▶ decides + renders + schedules + sends
(timing/conditions: nowhere)             (timing/conditions/templates/prefs: all here, admin-editable)
```

## Who uses it

| Consumer | Kind | Emits events like |
|----------|------|-------------------|
| **core-platform** | micro-tool host | `trial_started`, `plan_purchased`, `trial_ended`, `integration_connected`, `checkout.initiated`, `checkout.completed` |
| **AI Creative Studio** (sd-listings-optimizer) | micro-tool | `generation_completed`, `activity` |
| **early-reviews** (future) | standalone platform | its own lifecycle events |
| **affiliates** (future) | standalone platform | its own lifecycle events |

Crucially, consumers are **not limited to the micro-tool ecosystem**. Any SalesDuo platform that can make an HTTP call can use sd-mail-service. That reusability is the primary reason it's a separate service — see [01-rationale](01-rationale-and-alternatives.md).

## What it owns vs what it doesn't

**Owns:** event ingestion, subscriber profiles, workflow definitions, scheduling (delayed + recurring), template rendering, email delivery, preferences/unsubscribe, suppression, delivery logs, the admin UI. It is also the **single email egress** for the platform — including required/**transactional** mail (OTP, password reset, invitation), sent via a synchronous API and exempt from unsubscribe so opting out never blocks a login code. See [04](04-event-and-workflow-model.md) and [13](13-rollout-phases.md).

**Does not own / know:** any product's database, business logic, billing state, or user model. It only knows what products **tell it** via events, plus the subscriber profile it builds up from those events.

## A concrete example (Creative Studio, email #2)

> "When a user signs up to Creative Studio but hasn't connected their Seller/Vendor Central account after 1 day, nudge them."

1. core-platform emits `trial_started` (under the `creative-studio` product) for the org.
2. sd-mail-service matches the **"no integration after 1 day"** workflow: it schedules a send for **+1 day**, marked to cancel if `integration_connected` arrives.
3. If the user connects within the day, core emits `integration_connected` → sd-mail-service **cancels** the pending send.
4. If the day passes and it's still pending → sd-mail-service renders the admin-authored template and sends the nudge.

No product wrote any timing code, SMTP code, or template code. An admin can edit the copy, the CTA links, and the "1 day" delay with **no deploy**. This pattern — **schedule-and-cancel** — is the heart of the system ([04](04-event-and-workflow-model.md)).

## Where to go next

- The reasoning and alternatives → [01-rationale-and-alternatives](01-rationale-and-alternatives.md)
- How it's built → [02-architecture](02-architecture.md)
- The data → [03-data-model](03-data-model.md)
- The event/workflow engine → [04-event-and-workflow-model](04-event-and-workflow-model.md)
- How products use it end-to-end → [08-integration-guide](08-integration-guide.md#usage-at-a-glance) (usage diagram)
