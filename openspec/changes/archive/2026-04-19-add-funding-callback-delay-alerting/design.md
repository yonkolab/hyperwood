## Context

The platform security spec requires callback delay alerting, but the current codebase only supports signed webhook processing and reconciliation-based alerts. There is no mechanism to identify transfers that have been waiting too long for a provider update.

## Decisions

### Decision: Implement a deterministic delay scan

There is no scheduler or background worker runtime in the repository. The practical first step is an internal scan endpoint that evaluates overdue transfers against a configured threshold and persists alerts.

### Decision: Only scan provider-backed transfers in unresolved states

Transfers without a linked provider cannot produce provider callbacks, and settled or failed transfers are no longer waiting. The scan therefore targets provider-backed deposits in `pending` plus provider-backed withdrawals in `pending` or `in_review`.

### Decision: Use the shared operations alert model

Callback delay alerts are persisted through the same operations alert store introduced for reconciliation failures. This keeps operator polling surfaces consistent and avoids introducing a second alert channel.
