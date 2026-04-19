## Context

The funding spec already requires reconciliation workflows, but the implementation stops at transfer mutation and ledger writes. There is no persisted run history and no discrepancy record.

## Decisions

### Decision: Persist runs and discrepancies separately

Runs summarize a single reconciliation execution. Discrepancies are durable child records so operations can inspect and resolve specific issues without losing the run context.

### Decision: Reconcile against authoritative transfer snapshots

The internal job accepts a list of expected transfer states from an external or authoritative source. This is sufficient to catch missing transfers and status drift without requiring a full provider integration layer.

### Decision: Validate ledger invariants during reconciliation

For key transfer states, reconciliation should also verify the expected ledger transaction exists. A settled deposit without a settlement ledger posting or a held withdrawal without a hold ledger posting is a real discrepancy even when the transfer status matches.

## Risks and Mitigations

- [False positives from partial provider data] The route processes only the supplied transfer snapshots and reports the compared count explicitly.
- [Operational data gets overwritten] Runs and discrepancies are append-only records with separate resolution fields.
- [Invariant rules sprawl] Ledger checks are limited to the transfer states that already imply specific ledger transaction types.
