# Realtime

Realtime and websocket APIs are not implemented in the current repository.

The current market data model exposes replay-oriented HTTP endpoints instead:

- `GET /api/v1/markets/{marketId}/order-book`
- `GET /api/v1/markets/{marketId}/order-book/deltas`
- `GET /api/v1/markets/{marketId}/trades`

These endpoints are enough for polling and snapshot-plus-delta recovery, but they are not websocket streams.

## Current recommendation

If realtime delivery is added later:

- keep OpenAPI for HTTP snapshot and recovery endpoints
- document websocket channels separately
- consider AsyncAPI for long-term event and stream documentation

This guide intentionally documents absence as well as presence so consumers do not assume a websocket API exists today.
