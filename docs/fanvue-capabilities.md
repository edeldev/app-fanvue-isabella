# Fanvue API capability matrix

Verified against the official documentation index, v1 reference/changelog, authentication, webhook, and versioning documentation on 2026-09-04. The OpenAPI specs are published at `/docs/openapi-v1.json` and `/docs/openapi.json`; implementation must pin generated/handwritten contracts to a reviewed spec revision.

Official sources:

- https://api.fanvue.com/docs/llms.txt
- https://api.fanvue.com/docs/openapi-v1.json
- https://api.fanvue.com/docs/authentication/implementation-guide
- https://api.fanvue.com/docs/authentication/scopes
- https://api.fanvue.com/docs/authentication/rate-limits
- https://api.fanvue.com/docs/versions/overview
- https://api.fanvue.com/docs/webhooks/event-catalog
- https://api.fanvue.com/docs/webhooks/signature-verification
- https://api.fanvue.com/docs/webhooks/delivery-and-idempotency
- https://api.fanvue.com/docs/changelog

## Platform rules

| Capability | Status | Confirmed contract / consequence |
|---|---|---|
| OAuth 2.0 authorization code | Supported | `https://auth.fanvue.com/oauth2/auth` and `/oauth2/token`. |
| PKCE S256 | Supported, required | Verifier 43–128 chars; state is required and must be verified. |
| Refresh tokens | Supported | Request `openid offline_access offline`; rotation must be persisted atomically. |
| Scopes | Supported | Relevant scopes: `read:self`, `read:fan`, `read:chat`, `write:chat`, `read:media`, `read:insights`; request only enabled capabilities. |
| Versioning | Supported, required | Header `X-Fanvue-API-Version`; documentation currently identifies `2025-06-26`. Keep it configurable and explicitly reviewed. |
| Rate limits | Supported | Default documented limit is 100 requests / 60 seconds per user; honor `X-RateLimit-*` and `Retry-After` on 429. |
| Webhook signatures | Supported | Standard Webhooks HMAC-SHA256 and `X-Fanvue-Signature`; verify raw bytes before parsing. |
| Delivery retries/deduplication | Supported | Respond quickly; persist provider event/message ID uniquely before processing. |

## CRM and automation

| Requirement | Status | Official surface / boundary |
|---|---|---|
| Current creator profile | Supported | `GET /v1/users/me`. |
| Followers | Supported | Followers list and `creator.follow.created`. No unfollow event is listed in the current creator event catalog; reconcile periodically. |
| Subscribers/lifecycle | Supported | Subscriber list; `creator.subscription.activated`, `.renewed`, `.deactivated`, `.cancel_at_period_end_changed`. |
| Chat list/history | Supported | Chat and per-user message endpoints with `read:chat`; use delta sync plus message webhooks. |
| Send direct message | Supported | Per-user message endpoint with `write:chat`. It is eligible for automation only after Validation Guard. |
| Mass messages | Supported | Smart/custom lists and mass-message endpoint; not part of the first safe scheduler slice. |
| Message lifecycle | Supported | `creator.message.received`, `.sent`, `.read`, `.deleted`, and reaction events. |
| Fan presence/mute | Supported | `creator.fan.presence_changed` and `.status_changed`; presence is advisory, not a durable conversation rule alone. |
| Earnings/purchases | Supported | Insights earnings/top-spenders and `creator.payment.succeeded`; refunds/disputes also have events. Store source and external identifiers. |
| Link purchase to message/post | Conditionally supported | Earnings can include `messageUuid` or `postUuid`. Attribute only when the API supplies that identifier. |
| Detect whether PPV message was purchased | Supported where response exposes it | Message pricing/purchase state and media `purchasedByFan` are documented. Validate exact v1 response schemas at adapter implementation. |
| Media/vault | Supported | Read/upload media and vault folder operations with media scopes. |
| Editable local templates | Supported locally | Fanvue also exposes read-only chat template endpoints; local templates remain the workflow source of truth unless explicitly mapped. |
| Scheduled message via Fanvue | Supported for mass messages | `scheduledAt` is documented for mass messages. CRM one-to-one timing remains owned locally unless its exact endpoint schema confirms otherwise. |
| Arbitrary offer object / discount automation | `NOT_SUPPORTED_BY_CURRENT_FANVUE_API` | No generic offer lifecycle is confirmed. Keep `SEND_OFFER` disabled behind an action capability. |
| Prove conversion causality without an external link ID | `NOT_SUPPORTED_BY_CURRENT_FANVUE_API` | Correlation is not causation. Report unattributed revenue separately. |
| Unfollow webhook | `NOT_SUPPORTED_BY_CURRENT_FANVUE_API` | Use reconciliation against follower lists; do not invent an event. |
| Workflow management | Local capability | Fanvue does not host CRM workflows; our engine owns them. |
| Conversation inactivity semantics | Local capability | Derived from message timestamps and creator settings; Fanvue does not decide resume policy. |

## Implementation gate

No adapter method is considered implemented until its path, method, scope, request schema, response schema, error responses and version are checked against the current v1 OpenAPI document. Unknown/unsupported actions fail closed with `NOT_SUPPORTED_BY_CURRENT_FANVUE_API`; they never fall back to demo data.

