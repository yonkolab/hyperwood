# Pagination

Hyperwood currently uses simple endpoint-specific pagination rather than a single shared pagination contract.

## Limit-based lists

Several endpoints accept a `limit` query parameter with capped maximums:

- `GET /api/v1/funding/deposits`
- `GET /api/v1/funding/withdrawals`
- `GET /api/v1/markets`
- `GET /api/v1/markets/{marketId}/trades`
- `GET /api/v1/portfolio/fills`
- `GET /api/v1/internal/funding/reconciliation/discrepancies`
- `GET /api/v1/internal/operations/reviews`

These endpoints return an array without a generic cursor wrapper.

## Sequence-based recovery

Order book deltas use a recovery cursor:

- `GET /api/v1/markets/{marketId}/order-book/deltas`

Relevant fields:

- request query: `afterSequence`
- response field: `recovery.nextAfterSequence`
- response field: `recovery.hasMore`

This is the current cursor model best suited for replayable market event streams.

## Recommendations for future growth

If more collection endpoints are added, consider standardizing on:

- cursor-based pagination for mutable timelines
- stable sort order guarantees
- explicit `nextCursor` and `hasMore` envelopes
