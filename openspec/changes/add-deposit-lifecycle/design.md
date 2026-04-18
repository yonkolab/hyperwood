## Context

The funding module currently jumps from linked methods directly to wallet seeding. There is no persisted transfer record, no pending state, and no user-visible deposit lifecycle.

## Decisions

### Decision: Introduce a transfer table now

Deposits need their own durable state model instead of overloading ledger transactions. The transfer record tracks the requested amount, method, currency, and lifecycle state before any ledger movement occurs.

### Decision: Keep pending deposits off the cash wallet

Pending deposits are not available balance. The ledger should only be updated once the deposit settles, preserving the existing cash semantics.

### Decision: Use internal settlement for now

There is no provider callback system yet. An internal settlement route is sufficient for bootstrap and integration testing while preserving the same state transitions needed by later provider orchestration.

## Risks and Mitigations

- [Users cannot see transfer state] Add authenticated deposit history reads alongside creation.
- [Settlement could be double-applied] Make settlement idempotent and ledger-backed within a transaction.
- [Transfer model might be needed for withdrawals too] Use a generic funding transfer table with a transfer type field even though only deposits are implemented now.
