# ADR-0003 — Declarative, admin-editable workflows

**Status:** Accepted

## Context

Event→email mappings, delays, and cancel-conditions must be editable by non-engineers across many products, without a deploy per campaign. But we don't want arbitrary user-authored logic (a Turing-complete DSL) running in the engine.

## Decision

Model workflows as **declarative data**: a trigger event key → an ordered list of steps from a fixed vocabulary (`send`, `delay`, `cancel_on`, `repeat`), stored as versioned JSON and edited in the admin UI.

## Consequences

- **+** Admins add/tune campaigns with no deploy.
- **+** Safe: no arbitrary code; the step schema bounds what's possible.
- **+** Versioned; in-flight runs pin their version, so edits don't disrupt running sequences.
- **−** Some advanced flows may need new step types (an engineering change) — acceptable and rare.

Detail: [04](../04-event-and-workflow-model.md), editor in [09](../09-admin-ui.md).
