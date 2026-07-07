# ADR-0002 — Schedule-and-cancel for delayed/conditional nudges

**Status:** Accepted

## Context

Many nudges are "send after N days **if** a condition still holds" (e.g. no integration after 1 day). Since the service doesn't own product state, it can't query "is this still true?" without coupling.

## Decision

Use **schedule-and-cancel**: on the trigger event, schedule a delayed send; a later **counter-event** (declared via a `cancel_on` step) cancels the pending run; if still active at the deadline, send.

## Alternatives considered

- **Callback to producer at deadline** — couples the service to each producer's API/auth; N integrations to maintain.
- **Producer-decides** (products emit "send nudge now") — pushes scheduling back into every product, defeating the purpose.

## Consequences

- **+** Fully decoupled; producers only emit facts.
- **+** Standard, well-understood pattern (Knock/Novu delay + cancellation keys).
- **−** Day-granularity timing; a cancel arriving after send is too late (acceptable).
- Requires durable delayed jobs (BullMQ) and idempotent fire-time checks.

Detail: [04](../04-event-and-workflow-model.md).
