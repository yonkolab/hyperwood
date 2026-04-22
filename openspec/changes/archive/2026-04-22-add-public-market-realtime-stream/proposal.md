## Why

Hyperwood already exposes snapshot and delta recovery for market state, but it still lacks a live public streaming surface. Consumers currently have to poll market detail, order book, and trades even though the canonical realtime spec requires a public market channel.

## What Changes

- add a public SSE endpoint for one market scope
- emit initial snapshot payloads with market summary, order book, and recent trades
- emit live public market events for order book, trade, status, and announcement updates
- document the recovery contract as SSE plus existing snapshot/delta endpoints
- add API coverage for the new stream endpoint

## Impact

- satisfies the first concrete realtime requirement without introducing websocket infrastructure
- keeps recovery on the existing HTTP snapshot/delta paths
- gives external consumers a single public streaming endpoint for market updates
