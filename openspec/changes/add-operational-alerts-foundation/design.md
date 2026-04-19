## Context

The platform security spec requires invariant and outage alerting, but the current codebase stops at rate-limit events, review queues, and reconciliation discrepancy persistence. Operators can discover failures manually, but there is no alert-specific feed.

## Decisions

### Decision: Start with persisted alerts, not external paging integrations

There is no external notification provider in the current codebase. The first useful step is a durable internal alert model that captures actionable failures and can be queried by operators.

### Decision: Generate alerts from critical funding reconciliation discrepancies

Reconciliation already identifies the strongest current invariant signals: missing internal transfers, status mismatches, and missing required ledger transactions. Those are concrete operational failures and are enough to establish the alerting model.

### Decision: Deduplicate alerts by source record

Each alert is keyed to a source record type and ID. This prevents duplicate alerts for the same discrepancy while keeping the system extensible for other alert sources later.
