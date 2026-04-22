## Overview

Implement a public market stream as Server-Sent Events. SSE keeps the transport simple, works with Fastify without extra dependencies, and fits the current single-process runtime. This slice intentionally does not solve private account streams or distributed fanout.

## Design

- create a market-scoped in-memory publisher/subscriber service
- expose `GET /api/v1/markets/:marketId/stream`
- on connect:
  - validate the market exists
  - send a `snapshot` event containing market detail, current order book snapshot, and recent trades
  - keep the connection open with heartbeat comments
- publish subsequent events from existing HTTP routes after successful mutations:
  - order create/cancel/amend -> `order_book_updated`
  - match run -> `trade_batch` and `order_book_updated`
  - market status/resolve/settle -> `status_changed`
  - market announcement publish -> `announcement_published`

## Recovery

The SSE stream is not the authoritative recovery source. Clients should:

1. connect and consume the initial `snapshot`
2. if they reconnect or suspect drift, call:
   - `GET /api/v1/markets/:marketId/order-book`
   - `GET /api/v1/markets/:marketId/order-book/deltas`

## Limits

- in-memory fanout only
- no authenticated private account channel in this slice
- no websocket transport in this slice
