## Overview

This slice adds dedicated historical read paths without changing persistence:

- account order history is derived from the existing `orders` table
- account fill history is served through a dedicated historical route using the existing fill model
- archived market candles are derived from `market_trades`

## Account historical paths

Both endpoints are authenticated and currency-scoped:

- `GET /api/v1/historical/portfolio/orders`
- `GET /api/v1/historical/portfolio/fills`

These are intentionally dedicated historical reads even though the underlying records may overlap with current data. The route shape gives clients a stable historical surface separate from the lighter current-state portfolio endpoints.

## Candle derivation

Candles are returned only for archived markets. Supported bucket intervals:

- `1h`
- `1d`

Each candle includes:

- bucket start and end
- OHLC in basis points
- traded quantity
- trade count

The implementation derives candles by grouping historical trades into time buckets in application code after loading the archived trade set.
