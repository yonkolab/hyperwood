# Realtime

Hyperwood now exposes a public market realtime stream over Server-Sent Events.

Current public realtime endpoint:

- `GET /api/v1/markets/{marketId}/stream`

Current recovery endpoints:

- `GET /api/v1/markets/{marketId}/order-book`
- `GET /api/v1/markets/{marketId}/order-book/deltas`
- `GET /api/v1/markets/{marketId}/trades`

## Stream model

The market stream is public and market-scoped.

The first event is always `snapshot`. It includes:

- market detail
- current order book snapshot
- recent trades
- latest known order book sequence

Subsequent events are typed public updates:

- `order_book_updated`
- `trade_batch`
- `status_changed`
- `announcement_published`

## Recovery model

The SSE stream is not the authoritative replay source.

If a client reconnects or suspects drift:

1. reconnect to the market stream
2. read the fresh `snapshot` event
3. if order book recovery is needed, call:
   - `GET /api/v1/markets/{marketId}/order-book`
   - `GET /api/v1/markets/{marketId}/order-book/deltas`

This keeps the live transport lightweight while preserving deterministic order book recovery through the existing HTTP sequence endpoints.

## What is still missing

The current repository still does not implement:

- private authenticated account streams
- websocket transport
- distributed multi-node stream fanout

If those surfaces are added later, AsyncAPI is still the right long-term documentation format for transport-level stream contracts.
