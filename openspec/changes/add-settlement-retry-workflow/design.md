## Design

The retry workflow reuses the existing settlement implementation in the markets module. The operations module adds:

- a review-queue projection for resolved, unsettled markets beyond the configured threshold
- an internal retry endpoint that calls the existing settlement path
- audit events for retry requests and retry failures

This keeps settlement accounting in one place and avoids introducing a parallel settlement code path under operations.

### Queue membership

Settlement retry items are derived from the same criteria as the settlement-failure alert scan:

- market status is `awaiting_resolution`
- a market resolution exists
- no settlement record exists
- the resolution approval time is older than `MARKET_SETTLEMENT_FAILURE_MINUTES`

### Retry endpoint

`POST /api/v1/internal/operations/settlement-retries/:marketId`

- requires the bootstrap token
- accepts optional `requestedBy`
- returns the same settlement payload shape as the internal market settlement endpoint
- records `market.settlement_retry_requested` on success
- records `market.settlement_retry_failed` on failure before rethrowing
