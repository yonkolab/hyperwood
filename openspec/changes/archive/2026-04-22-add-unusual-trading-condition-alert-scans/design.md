## Overview

The scan runs as an internal bootstrap-token-protected operation. It checks active markets for crossed order books, where the best resting bid is greater than or equal to the best resting ask for the same outcome. Each affected market produces at most one persisted alert because the operations alert table already deduplicates by `(sourceType, sourceId)`.

## Detection rule

A market is flagged when:

- market status is `active`
- the current order-book snapshot contains at least one outcome book where:
  - `bestBidPriceBps` is not null
  - `bestAskPriceBps` is not null
  - `bestBidPriceBps >= bestAskPriceBps`

## Alert shape

- category: `unusual_trading_condition`
- severity: `critical`
- sourceType: `market`
- sourceId: market id

## API

- `POST /api/v1/internal/operations/trading-condition-scan`
  - optional body:
    - `limit`
  - response:
    - generated timestamp
    - number of newly created alerts
    - list of affected markets with crossed outcomes
