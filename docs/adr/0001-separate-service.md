# ADR-0001 — A separate notification service, not email inside core-platform

**Status:** Accepted

## Context

We need event-driven lifecycle emails across multiple SalesDuo platforms. An earlier draft embedded the engine inside core-platform, reading `Subscription`/`IntegrationAccount`/`credit_ledger` directly. But consumers include platforms **outside** the micro-tool system (early-reviews, affiliates) with their own datastores, plus core-platform and the studio.

## Decision

Build a **standalone service** (`sd-mail-service`) in its own repo. Products integrate by **emitting events**; the service never reads any product's database.

## Consequences

- **+** Reusable by any platform in any language via one small contract.
- **+** No coupling to any product's schema; independent deploy/scale.
- **+** Single place for scheduling, templates, preferences, and compliance.
- **−** One more service to operate; producers must emit events.
- Timing/conditions move out of products (most of which have no scheduler) into the service.

Related: [ADR-0002](0002-schedule-and-cancel.md), [ADR-0004](0004-subscriber-profiles.md). Rationale detail in [01](../01-rationale-and-alternatives.md).
