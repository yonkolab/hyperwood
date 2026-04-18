## Why

Hyperwood now accepts orders, sequences market commands, and exposes snapshot-plus-delta recovery, but no process actually executes compatible orders. The next executable step is a bounded matching slice that proves price-time priority and emits durable trade records without pretending the entire exchange engine is complete.

## What Changes

- `matching-and-orderbook`: implement deterministic matching for crossable limit orders using price-time priority.
- Add persisted trade records plus an internal market match endpoint to advance queued orders into filled or partially-filled states.

## Impact

- Adds an OpenSpec delta under `openspec/changes/add-limit-order-matching/specs/matching-and-orderbook/spec.md`.
- Adds order fill state and trade persistence to the database schema.
- Adds internal `POST /api/v1/internal/markets/:marketId/match` and public `GET /api/v1/markets/:marketId/trades` routes.
