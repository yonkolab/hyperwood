## Why

Hyperwood can already put withdrawals into review and persist reconciliation discrepancies, but operators still do not have a dedicated queue to inspect those items. That leaves a gap between detection and action.

## What Changes

- Add an internal operations review queue for withdrawals awaiting review.
- Add an internal operations investigation queue for unresolved reconciliation discrepancies.
- Expose the user, funding method, and review context needed to triage each item.

## Impact

- Operations can query the active withdrawal review workload without scanning raw transfers.
- Reconciliation discrepancies become visible as an investigation queue instead of only as low-level records.
- The admin-and-exchange-operations capability gains an executable surface for sensitive review flows.
