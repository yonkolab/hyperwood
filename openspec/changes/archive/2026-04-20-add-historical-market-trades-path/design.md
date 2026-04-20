## Overview

This slice implements the first dedicated historical market-data path under `/api/v1/historical/...`.

## Decisions

### Archived market definition

For now, a market is considered historical when its status is one of:

- `settled`
- `voided`
- `cancelled`

This aligns with markets that are no longer actively tradable and whose trades should be consumed through archival reads.

### Live route behavior

`GET /api/v1/markets/:marketId/trades` returns `410 historical_market_data` for archived markets. The error message directs clients to the historical path.

### Historical route behavior

`GET /api/v1/historical/markets/:marketId/trades` returns the archived trade list for historical markets. Non-historical markets are rejected with `409 market_not_archived`.

## Testing

- API coverage verifies the live route rejects archived-market trade reads
- API coverage verifies the historical route returns archived trades after settlement
