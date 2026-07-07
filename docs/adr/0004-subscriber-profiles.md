# ADR-0004 — Maintain subscriber profiles (stateful)

**Status:** Accepted

## Context

Some workflows need recipient state the service can't get from a single event — notably inactivity ("no use in 2 weeks") which needs a `last_seen_at`, and preferences/unsubscribe which need per-recipient storage.

## Decision

Maintain a **subscriber profile** per `(product, external_id)`: email, name, attributes, `last_seen_at`, timezone, preferences — **upserted by incoming events**.

## Alternatives considered

- **Stateless** (every event carries all recipient data) — makes inactivity and preferences impossible without pushing state back into producers, and makes every event heavy.

## Consequences

- **+** Enables inactivity nudges, preferences, and thin follow-up events.
- **+** Single source of recipient truth for rendering and audience resolution.
- **−** A small PII store to secure and retain responsibly (see [11](../11-security-and-compliance.md)).

This is the Knock/Novu "subscriber" model.
