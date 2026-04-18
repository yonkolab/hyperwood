## Why

Hyperwood can now reserve order collateral, match limit orders, and expose derived portfolio data, but the ledger still leaves all matched exposure inside the resting-order reserve wallet. That makes wallet balances, cancellation behavior, and portfolio collateral semantics drift apart after fills.

## What Changes

- `funding-and-ledger`: reclassify matched collateral from resting order reserve into a dedicated position collateral wallet and release fill-time price improvement back to cash.
- `trading-and-order-management`: allow cancellation of the remaining quantity on partially-filled orders using the current remaining reserve amount.
- `portfolio-and-settlement`: expose position collateral directly from wallet balances rather than inferring it as a residual.

## Impact

- Adds OpenSpec deltas under `openspec/changes/reclassify-collateral-on-match/specs/funding-and-ledger/spec.md`, `.../trading-and-order-management/spec.md`, and `.../portfolio-and-settlement/spec.md`.
- Extends wallet account types and matching/cancellation flows.
- Adds a schema migration for the new wallet account type.
