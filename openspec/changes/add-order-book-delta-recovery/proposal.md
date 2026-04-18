## Why

The platform now exposes market snapshots and deterministic market command sequencing, but clients still have no executable recovery path from a known snapshot sequence to later market changes. The base realtime spec requires snapshot-plus-delta recovery semantics even before a websocket transport exists.

## What Changes

- `matching-and-orderbook`: add a sequenced order book delta feed derived from the market command log.
- `realtime-and-historical-data`: define the HTTP recovery path for clients resynchronizing from a snapshot sequence.

## Impact

- Adds an OpenSpec delta under `openspec/changes/add-order-book-delta-recovery/specs/matching-and-orderbook/spec.md`.
- Adds an OpenSpec delta under `openspec/changes/add-order-book-delta-recovery/specs/realtime-and-historical-data/spec.md`.
- Adds a public `GET /api/v1/markets/:marketId/order-book/deltas` endpoint backed by the persisted market command stream.
