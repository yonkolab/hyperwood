## Why

Hyperwood now accepts, matches, and records trades, but authenticated users still have no derived portfolio view. The portfolio spec requires balances, resting order value, open positions, and recent account activity to be exposed from authoritative ledger and execution records.

## What Changes

- `portfolio-and-settlement`: add the first authenticated portfolio summary and fill history read APIs.
- Derive positions from recorded trades and derive recent account activity from ledger transactions that touch user-owned wallet accounts.

## Impact

- Adds an OpenSpec delta under `openspec/changes/add-portfolio-summary-views/specs/portfolio-and-settlement/spec.md`.
- Adds authenticated `GET /api/v1/portfolio` and `GET /api/v1/portfolio/fills` routes.
- No schema change in this slice; all reads come from existing ledger, order, trade, and market records.
