# Incremental implementation plan

Each phase ends with lint, typecheck, focused tests, and production build. No phase enables a Fanvue action before its OpenAPI contract and runtime schema are reviewed.

## Phase 0 — Discovery (complete)

- Official capability matrix and unsupported boundaries.
- Modular-monolith architecture, domain/state design, scheduler and guard design.
- Multi-creator PostgreSQL model and implementation order.

## Phase 1 — Foundation (current)

- Next.js App Router, TypeScript strict mode, Tailwind, reusable UI primitives.
- Application shell and honest empty dashboard.
- Zod environment validation, structured/redacted logger.
- Prisma/PostgreSQL schema with tenant keys, indexes, idempotency records and partial-index migration design.
- Domain enums/contracts and baseline tests.

Exit: app builds without credentials or a running database; database commands work once `DATABASE_URL` is provided.

## Phase 2 — Fanvue integration

1. Snapshot/review current v1 OpenAPI and generate a contract manifest.
2. OAuth + PKCE + state; encrypted credential repository and atomic refresh rotation.
3. Versioned client, Zod response parsing, normalized errors, rate-limit/backoff policy.
4. Standard Webhooks raw-body verification and durable inbox.
5. Idempotent sync of creator, followers, subscribers, chats and earnings.

## Phase 3 — CRM

Fans query/pagination/filters, detail profile, financial facts, conversation, automation panel and unified timeline. Empty/error/loading states use real repository results only.

## Phase 4 — Workflow engine

Immutable workflow versions, typed step configs, legal transition service, priority resolver and atomic workflow switch enforcing one primary enrollment.

## Phase 5 — Validation Guard

Independent rules for validity, purchase, conversation, send window, already-sent, subscription and retries. Add exhaustive decision/evidence tests.

## Phase 6 — Scheduler

PostgreSQL claim/lease, execution fence, guard, action dispatch, exponential retry with jitter, reconciliation and next-step calculation. Protected invocation endpoint for local/Vercel cron.

## Phase 7 — Messages, templates and content

Editable local library, confirmed Fanvue mappings, message send action, delivery state and PPV only where the v1 contract supplies purchase/media semantics.

## Phase 8 — Dashboard

Repository-derived KPIs, chronological recent activity, pending/error health and drill-downs.

## Phase 9 — Analytics

Workflow funnel and revenue. Message/post attribution only from provider identifiers; explicit “unattributed” bucket otherwise.

## Phase 10 — Hardening

Threat review, webhook fixtures, concurrency tests, query plans/index review, secret/log audit, accessibility/responsiveness, dependency audit and production deployment checklist.

