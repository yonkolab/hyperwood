## Why

Hyperwood now has executable deposit and withdrawal lifecycles, but there is still no persisted reconciliation workflow. That means transfer state and ledger invariants can drift silently.

## What Changes

- Add reconciliation run and discrepancy storage for funding transfers.
- Add an internal reconciliation endpoint that compares authoritative transfer snapshots to internal state.
- Record ledger invariant failures alongside state mismatches.

## Impact

- Funding operations gain an audit trail for reconciliation jobs.
- Transfer and ledger drift becomes queryable instead of implicit.
- Later provider webhooks can reuse the same discrepancy model.
