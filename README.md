# sd-mail-service

A **standalone, multi-product notification / lifecycle-messaging service** for SalesDuo. Any product — core-platform, AI Creative Studio, and platforms outside the micro-tool system (early-reviews, affiliates) — sends users **personalized, event-driven emails** (welcome, onboarding nudges, trial-ended, re-engagement) by **emitting events**. The service owns templates, scheduling, delayed/conditional nudges (schedule-and-cancel), delivery, preferences, and compliance. It never touches a product's database.

> **Status: design documentation (pre-build).** No application code yet — this repo currently holds the architecture docs that define the service before implementation.

## Documentation

Everything lives in **[`docs/`](docs/)**. Start with the [docs README](docs/README.md), then:

- [Overview](docs/00-overview.md) · [Rationale & alternatives](docs/01-rationale-and-alternatives.md)
- [Architecture](docs/02-architecture.md) · [Data model (DBML + ER)](docs/03-data-model.md) · [Event & workflow model](docs/04-event-and-workflow-model.md)
- [Features](docs/05-features.md) · [Edge cases](docs/06-edge-cases-and-failure-modes.md) · [Creative Studio worked example](docs/07-creative-studio-example.md)
- [Integration guide](docs/08-integration-guide.md) · [Admin UI](docs/09-admin-ui.md) · [Delivery & channels](docs/10-delivery-and-channels.md)
- [Security & compliance](docs/11-security-and-compliance.md) · [Observability & ops](docs/12-observability-and-ops.md) · [Rollout phases](docs/13-rollout-phases.md) · [Glossary](docs/14-glossary.md)
- [Architecture Decision Records](docs/adr/)

Import-ready artifacts: **[`docs/schema.dbml`](docs/schema.dbml)** (paste into [dbdiagram.io](https://dbdiagram.io)) and **[`docs/diagrams/`](docs/diagrams/)** (Mermaid `.mmd` files).

## At a glance

Build in-house · Node.js + TypeScript · Postgres · BullMQ/Redis · **schedule-and-cancel** event model · subscriber profiles · declarative admin-editable workflows · email delivery (multi-channel-ready) · owns preferences + unsubscribe · single-superadmin admin UI.
