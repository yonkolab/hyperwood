## Why

Hyperwood can now accept and cancel resting orders, but public clients still cannot inspect the live depth those orders create. The next useful matching slice is a read-only order book snapshot API derived from current resting limit orders.

## What Changes

- Add a public order book snapshot endpoint for a market.
- Aggregate resting limit orders into price-level depth with best bid and ask views for YES and NO books.
- Include a snapshot sequence token and timestamp so clients have a stable baseline before future delta streams exist.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `matching-and-orderbook`: add the first executable order book snapshot view for resting orders.

## Impact

- Adds an OpenSpec delta under `openspec/changes/add-order-book-snapshots/specs/matching-and-orderbook/spec.md`.
- Extends the market-facing read APIs with a public order book snapshot route.
- Reuses current resting order persistence without adding new schema.
