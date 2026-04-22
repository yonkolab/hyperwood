# Realtime

Hyperwood now exposes realtime streams over Server-Sent Events.

Current public realtime endpoint:

- `GET /api/v1/markets/{marketId}/stream`

Current authenticated account realtime endpoint:

- `GET /api/v1/portfolio/stream?currency=USD|BRL`

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

The account stream is authenticated and scoped to one user and one currency.

The first event is always `account_snapshot`. It includes:

- portfolio summary
- recent fills
- recent settlements

Subsequent events are typed private updates:

- `order_updated`
- `balance_updated`
- `transfer_updated`
- `fill_batch`
- `settlement_updated`

## Recovery model

The SSE stream is not the authoritative replay source.

If a client reconnects or suspects drift:

1. reconnect to the market stream
2. read the fresh `snapshot` event
3. if order book recovery is needed, call:
   - `GET /api/v1/markets/{marketId}/order-book`
   - `GET /api/v1/markets/{marketId}/order-book/deltas`

This keeps the live transport lightweight while preserving deterministic order book recovery through the existing HTTP sequence endpoints.

For the account stream, reconnecting clients should treat `account_snapshot` as the authoritative reset point for the scoped currency view.

## What is still missing

The current repository still does not implement:

- websocket transport
- distributed multi-node stream fanout

The authenticated account stream now exists, but it is still single-process SSE without multi-node fanout.

If those surfaces are added later, AsyncAPI is still the right long-term documentation format for transport-level stream contracts.
