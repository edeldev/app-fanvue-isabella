# Domain model and state design

## Aggregates

- **Creator** is the tenant root and maps to a Fanvue creator identity.
- **Fan** is a creator-scoped relationship with a Fanvue user. Follower, subscriber and buyer are orthogonal facts, not one lossy status enum.
- **Subscription**, **Purchase**, **Conversation**, and **Message** are external facts normalized from sync/webhooks.
- **Content** represents locally addressable media/content and maps by immutable external UUID when available.
- **MessageTemplate** owns editable copy; workflow steps reference its ID.
- **Workflow** contains ordered, versioned steps. Published definitions are immutable.
- **WorkflowEnrollment** is the fan’s progress through one workflow version.
- **AutomationExecution** fences each attempted step; **AutomationLog** explains decisions and results.
- **FanEvent** is the normalized event inbox; **WebhookEvent** is the verified provider delivery record.
- **IntegrationCredential** is an encrypted server-side credential set per creator/provider.
- **Settings** controls tenant automation, sending window, retries and conversation resume strategy.

## Enrollment state machine

```text
ACTIVE ↔ WAITING
ACTIVE/WAITING → PAUSED → ACTIVE/WAITING
ACTIVE/WAITING/PAUSED → COMPLETED | CANCELLED | FAILED
```

Terminal states never transition. `nextRunAt` is required only for schedulable `ACTIVE`/`WAITING` states. Paused and terminal enrollments cannot be claimed. At most one primary enrollment per fan is non-terminal (`ACTIVE`, `WAITING`, `PAUSED`).

## Execution state machine

`PENDING → RUNNING → SUCCESS | FAILED | SKIPPED | RETRYING`

`RETRYING` schedules a new attempt but retains the same logical idempotency lineage. A stale `RUNNING` execution is reconciled; it is not blindly replayed.

## Validation decision

- `SEND`: all rules allow the action.
- `WAIT`: a current condition may clear; record reason and next evaluation.
- `SKIP`: this step is no longer needed; advance safely.
- `CANCEL`: workflow purpose is no longer valid.
- `CHANGE_WORKFLOW`: current facts select a higher-priority strategy.
- `RETRY`: transient dependency failure prevented a reliable decision/action.

Rules return typed evidence and never execute side effects. Precedence is `CANCEL/CHANGE_WORKFLOW`, `RETRY`, `WAIT`, `SKIP`, `SEND`. Every aggregate decision stores rule results for explainability.

## Event transitions

| Event | State update | Workflow consequence |
|---|---|---|
| `FOLLOW_CREATED` | `isFollower=true` | Evaluate Follower workflow if no higher-priority state. |
| `SUBSCRIPTION_ACTIVATED` | upsert active subscription | Cancel Follower enrollment; start Subscriber workflow atomically. |
| `SUBSCRIPTION_DEACTIVATED` | close subscription | Re-evaluate reactivation eligibility. |
| `PAYMENT_SUCCEEDED` | idempotent purchase/revenue fact | Re-evaluate Buyer/VIP priority and content-purchase guards. |
| `MESSAGE_RECEIVED` | append inbound message/activity | Pause primary automation when conversation policy says active. |
| conversation becomes inactive | derived evaluation | Resume only per settings and through Validation Guard. |
| refund/dispute | record reversal | Recompute financial read model; never delete original purchase. |

## Workflow step configuration

Steps have a typed `type` plus validated JSON configuration. Initial engine types are `SEND_MESSAGE`, `WAIT`, `CONDITION`, `CHANGE_WORKFLOW`, and `END`. `SEND_PPV` is enabled only when it maps to a confirmed message/media contract. `SEND_OFFER` remains modeled but disabled as `NOT_SUPPORTED_BY_CURRENT_FANVUE_API`.

## Segments

Segments are pure creator-scoped predicates over facts (follower, active subscriber, purchase/revenue, activity). MVP system segments are code-defined and centrally registered; saved custom rule trees can be added without distributing checks through UI/services.

