## Overview

The scan runs as an internal bootstrap-token-protected operation. It identifies markets with a recorded resolution, no settlement record, and a resolution approval timestamp older than the configured threshold. Each affected market produces at most one persisted alert because the operations alert table already deduplicates by `(sourceType, sourceId)`.

## Detection rule

A market is flagged when all of the following are true:

- market status is `awaiting_resolution`
- a resolution record exists
- no settlement record exists
- resolution `approvedAt` is older than `MARKET_SETTLEMENT_FAILURE_MINUTES`

## Alert shape

- category: `market_settlement_failure`
- severity: `critical`
- sourceType: `market`
- sourceId: market id

## API

- `POST /api/v1/internal/operations/settlement-failure-scan`
  - optional body:
    - `limit`
  - response:
    - generated timestamp
    - threshold minutes
    - number of newly created alerts
    - list of stalled settlements
