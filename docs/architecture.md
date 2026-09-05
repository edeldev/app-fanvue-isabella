# Fanvue CRM & Automation Platform — Architecture

Status: Phase 0 baseline · Reviewed 2026-09-04

## Product invariant

An action is never executed only because it is due. Every due action follows:

`Observe → Evaluate → Validate → Act → Record → Re-evaluate`

The Validation Guard reads current local state immediately before an action and returns an explainable decision: `SEND`, `WAIT`, `SKIP`, `CANCEL`, `CHANGE_WORKFLOW`, or `RETRY`.

## Shape

The MVP is a modular monolith deployed as one Next.js application with PostgreSQL. This costs $0 locally and can use free hosted tiers later. Domain code does not import React, Next.js, Prisma, or Fanvue code.

```text
Browser → Next.js UI / route handlers → application services → domain
                                      ↘ repositories → Prisma → PostgreSQL
                                      ↘ Fanvue port → Fanvue adapter → Fanvue API
Cron/route → Scheduler port → claim due enrollment → Validation Guard → action port
Webhook → signature verification → inbox/deduplication → event handler → domain
```

## Module boundaries

- `src/domain`: entities, states, transitions, rules, and ports. Pure TypeScript.
- `src/services`: use cases that coordinate domain and ports.
- `src/repositories`: repository contracts and Prisma implementations.
- `src/lib/fanvue`: the only code allowed to call Fanvue.
- `src/features`: presentation and feature-specific composition.
- `src/app`: routes, layouts, server entry points; no business rules.
- `src/components`: shared UI primitives and application shell.
- `src/config`: validated server configuration.
- `prisma`: persistence schema and migrations.

Dependencies point inward: UI/infrastructure → application → domain. Fanvue DTOs are validated and mapped before entering the domain.

## Automation transaction boundary

1. Claim one due enrollment atomically (`lockedAt`, `lockOwner`, `lockExpiresAt`).
2. Create a unique execution record before side effects.
3. Reload fan, subscription, purchases, conversation, workflow and settings.
4. Run independent ordered validation rules.
5. Persist the decision and human-readable reason.
6. For a side effect, use a stable idempotency key derived from creator/enrollment/step/attempt lineage.
7. Persist result, transition enrollment, and schedule the next evaluation in one transaction.

External HTTP and database transactions must not overlap for long. An execution row is the durable fence around the external request. Unknown outcomes are reconciled before retrying.

## Multi-creator isolation

Every creator-owned aggregate has `creatorId`. Composite unique constraints include it when external IDs are only unique within an account. Every repository method requires creator context; future row-level security can reinforce this boundary.

## Security

- OAuth authorization code + mandatory PKCE; state and verifier stay server-side/HttpOnly.
- Access and refresh tokens are encrypted at rest using an application key and never returned to the browser or logs.
- Pin `X-Fanvue-API-Version`; version changes are explicit releases.
- Verify Standard Webhooks signatures against the raw request body before parsing.
- Store webhook IDs with a unique constraint before processing.
- Logs use an allowlist and redact authorization, cookies, tokens, secrets and personal payloads.
- The initial requested scopes are the minimum needed by enabled features.

## Replaceable infrastructure

`Scheduler`, `Clock`, `FanvueGateway`, repositories, encryption, and logger are ports. The initial scheduler is database-backed and invoked by a protected route/cron. A queue can replace it without changing validation or workflow transitions.

## Important decisions

- Workflows are versioned configuration. Published versions are immutable so active enrollments remain reproducible.
- One primary active enrollment is enforced with a PostgreSQL partial unique index in a migration; Prisma alone cannot express it.
- Financial amounts use integer minor units plus ISO currency, never floating point.
- Raw external payloads are retained only where operationally necessary and must be sanitized; normalized fields drive the product.
- Timeline is a read model assembled from domain events, messages, purchases and automation logs rather than a second source of truth.

