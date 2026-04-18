## Why

Hyperwood already has identity and compliance capability gating, but it still has no executable funding layer. The next useful slice is to let compliant users see eligible funding methods and inspect a wallet balance derived from append-only ledger entries.

## What Changes

- Add linked funding method persistence with verification and provider metadata.
- Add wallet accounts and append-only double-entry ledger tables.
- Expose authenticated routes for funding method listing and wallet balance inspection.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `funding-and-ledger`: begin the executable implementation of funding method registry and ledger-backed wallet state.

## Impact

- Adds an OpenSpec delta under `openspec/changes/add-funding-method-registry/specs/funding-and-ledger/spec.md`.
- Introduces a funding module with wallet balance and funding method queries.
- Establishes the first append-only ledger foundation for later deposits, withdrawals, and reservations.
