# ADR-0005 — Build in-house on Node/TypeScript

**Status:** Accepted

## Context

We could build the service, self-host an open-source platform (Novu/Knock-style), or wrap a SaaS (Customer.io/SendGrid). We also need a stack.

## Decision

**Build in-house**, in **Node.js + TypeScript**, using Nodemailer (email), BullMQ on Redis (durable delayed/recurring jobs), and Postgres.

## Rationale

- Our scope (a handful of event types, declarative workflows, email first) is small enough that building beats operating and bending a general-purpose platform.
- Full control over auth, infra, event vocabulary, and data residency (PII stays in our systems).
- Node/TS matches core-platform → shared patterns, easier staffing, and reuse of existing nodemailer/Redis-lock idioms.

## Alternatives considered

- **Self-host Novu/Knock** — rich features fast, but a large dependency to learn/operate and an upgrade treadmill.
- **SaaS provider** — least infra, but ongoing cost, PII leaves our systems, less long-term control.
- **Python (FastAPI/Celery)** — matches the studio, but diverges from core-platform's tooling.

## Consequences

- **+** Tailored, controllable, consistent with core.
- **−** Upfront engineering; we own operations and deliverability tuning (SES).

Detail: [01](../01-rationale-and-alternatives.md).
