# sd-mail-service — Design Documentation

`sd-mail-service` is a **standalone, multi-product notification / lifecycle-messaging service** for SalesDuo. Any product — core-platform, AI Creative Studio, and platforms outside the micro-tool system (early-reviews, affiliates) — sends users **personalized, event-driven emails** (welcome, onboarding nudges, trial-ended, re-engagement) by **emitting events**. The service owns templates, scheduling, delayed/conditional nudges, delivery, preferences, and compliance. It never touches a product's database.

> Status: **implemented.** These documents describe the architecture of the service now built in `backend/` (Express + TS + Sequelize + BullMQ) and `admin/` (React + Vite).

## How to read these docs

Start at **[00-overview](00-overview.md)** for the one-pager, then **[01-rationale-and-alternatives](01-rationale-and-alternatives.md)** for *why this shape*. From there:

| Doc | What's inside |
|-----|---------------|
| [00-overview](00-overview.md) | What it is, who uses it, the core shift |
| [01-rationale-and-alternatives](01-rationale-and-alternatives.md) | Why a separate service, alternatives compared, non-goals |
| [02-architecture](02-architecture.md) | Components, processes, system & deployment diagrams |
| [03-data-model](03-data-model.md) | DBML schema (dbdiagram.io) + ER diagram + table notes |
| [04-event-and-workflow-model](04-event-and-workflow-model.md) | Event contract, workflow steps, schedule-and-cancel, state machines |
| [05-features](05-features.md) | Feature catalog and v1-vs-later matrix |
| [06-edge-cases-and-failure-modes](06-edge-cases-and-failure-modes.md) | Every tricky case and how it's handled |
| [07-creative-studio-example](07-creative-studio-example.md) | The 6 Creative Studio emails as concrete workflows |
| [08-integration-guide](08-integration-guide.md) | Producers: plain-HTTP REST, shared-key auth, idempotency |
| [09-admin-ui](09-admin-ui.md) | Admin surface (single superadmin, no RBAC) |
| [10-delivery-and-channels](10-delivery-and-channels.md) | Channel drivers, email first, provider abstraction |
| [11-security-and-compliance](11-security-and-compliance.md) | Shared-key auth, PII, unsubscribe/CAN-SPAM, suppression |
| [12-observability-and-ops](12-observability-and-ops.md) | Logging, metrics, retries/DLQ, runbook, scaling |
| [13-rollout-phases](13-rollout-phases.md) | Phased delivery + migration of existing emails |
| [14-glossary](14-glossary.md) | Terms: subscriber, workflow, run, step, template… |
| [15-email-fundamentals](15-email-fundamentals.md) | Email from first principles: SMTP, SES/SNS, bounces/reputation, SPF/DKIM/DMARC, and the SNS signature-verification webhook |
| [adr/](adr/) | Architecture Decision Records — one per locked decision |

## Import-ready artifacts

- **[schema.dbml](schema.dbml)** — paste directly into [dbdiagram.io](https://dbdiagram.io).
- **[diagrams/](diagrams/)** — individual `.mmd` files (`system`, `usage`, `schedule-and-cancel`, `transactional-send`, `run-state-machine`, `er`) for [Mermaid Live](https://mermaid.live). The `usage` diagram (end-to-end actor lifecycle) is also rendered in [08-integration-guide](08-integration-guide.md#usage-at-a-glance).

## Locked design decisions (at a glance)

Build in-house · own repo · **Node.js + TypeScript** · **schedule-and-cancel** event model · owns email delivery, **multi-channel-ready** · **subscriber profiles** · **declarative admin-editable workflows** · **own admin UI** (single superadmin, no RBAC) · owns **preferences + unsubscribe** · **single email egress incl. transactional** (OTP/reset/invite via a synchronous API, exempt from unsubscribe).

Each of these has a dedicated [ADR](adr/).
