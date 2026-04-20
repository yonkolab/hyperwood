# Historical Data

Hyperwood separates live operational market reads from archived market-history reads.

## Archived market trades

For active operational markets, use:

- `GET /api/v1/markets/:marketId/trades`

For archived markets, use:

- `GET /api/v1/historical/markets/:marketId/trades`

Archived markets currently include:

- `settled`
- `voided`
- `cancelled`

## Archival boundary behavior

If a client requests trades from the live market trades path for an archived market, the API returns:

- `410 historical_market_data`

The response message directs the client to the historical path.

If a client requests the historical path for a market that is not archived yet, the API returns:

- `409 market_not_archived`

## Example

```bash
curl "http://localhost:3000/api/v1/historical/markets/MARKET_ID/trades?limit=50"
```

The historical trades response uses the same trade payload shape as the live trades route.
