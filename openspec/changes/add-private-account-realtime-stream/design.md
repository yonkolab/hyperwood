## Overview

Implement a private authenticated account stream over Server-Sent Events. Like the public market stream, this slice stays inside the current single-process Fastify runtime and uses in-memory fanout.

## Design

- expose `GET /api/v1/portfolio/stream?currency=USD|BRL`
- authenticate the caller with the existing bearer session flow
- on connect:
  - send `account_snapshot` with portfolio summary, recent fills, and recent settlements
  - keep the connection open with heartbeat comments
- publish user-scoped events from existing routes:
  - orders -> `order_updated`, `balance_updated`
  - funding transfers -> `transfer_updated`, `balance_updated`
  - matching -> `fill_batch`, `balance_updated`
  - settlement -> `settlement_updated`, `balance_updated`

## Scope and limits

- one user and one currency per stream connection
- in-memory fanout only
- no websocket transport
- no durable replay on the stream itself; clients can reconnect and use the snapshot event as the authoritative reset point
