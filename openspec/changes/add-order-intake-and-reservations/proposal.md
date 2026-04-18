## Why

Hyperwood now has market discovery, identity, compliance gating, and ledger-backed wallets, but users still cannot submit executable trading intents. The next useful step is to accept authenticated orders in a spec-aligned way and reserve the maximum possible loss in the ledger before matching exists.

## What Changes

- Add authenticated order intake for binary YES and NO markets on both buy and sell sides.
- Add idempotent order creation so repeated client submissions do not create duplicate intents or duplicate reservations.
- Add ledger-backed order collateral reservation by moving funds from available cash into a reserved wallet account at order acceptance time.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `trading-and-order-management`: add the first executable order creation flow with validations and idempotent replay.
- `funding-and-ledger`: extend the ledger slice to reserve order collateral in append-only ledger entries.

## Impact

- Adds OpenSpec deltas under `openspec/changes/add-order-intake-and-reservations/specs/`.
- Introduces order persistence, idempotency handling, and authenticated order routes.
- Extends wallet account modeling and ledger transaction flows for order reservations.
