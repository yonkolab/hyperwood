## Why

Hyperwood can now accept idempotent orders and reserve collateral, but there is no way to unwind a resting order before matching exists. The next useful slice is user-driven cancellation that updates order state and releases reserved funds through the ledger.

## What Changes

- Add authenticated order cancellation for eligible resting orders.
- Release reserved order collateral by moving funds from reserved cash back into available cash with append-only ledger entries.
- Return the updated canceled order state to the caller.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `trading-and-order-management`: add executable order cancellation for resting orders.
- `funding-and-ledger`: add ledger-backed reservation release on cancellation.

## Impact

- Adds OpenSpec deltas under `openspec/changes/add-order-cancellation-release/specs/`.
- Extends the orders module with cancellation logic and a new authenticated route.
- Adds an order cancellation timestamp column and a migration.
