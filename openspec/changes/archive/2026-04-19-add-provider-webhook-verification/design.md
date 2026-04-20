## Context

The platform security spec already requires signed provider webhooks, and the funding spec already depends on provider reconciliation hooks. The current implementation has neither a callback endpoint nor signature verification.

## Decisions

### Decision: Start with funding provider transfer updates

The most concrete current need is funding transfer progression. A single provider webhook endpoint for `funding.transfer.updated` events covers the real money movement surface already implemented in the codebase.

### Decision: Use timestamped HMAC with a deterministic canonical payload

The current Fastify setup does not preserve raw request bodies for route-local signature verification. Instead of pretending to verify the raw JSON bytes, the webhook contract defines a canonical payload derived from explicit fields plus a timestamp header. This is stable, documentable, and enforceable with current runtime constraints.

### Decision: Make provider event processing idempotent

Provider webhooks will be retried. The platform stores processed webhook events keyed by provider and event ID so duplicates can be acknowledged without replaying ledger side effects.

### Decision: Only support current executable transfer transitions

The callback path supports `pending`, `in_review`, `settled`, and `failed`. Reversal handling is not implemented yet because the current funding model does not yet support safe post-settlement reversals.
