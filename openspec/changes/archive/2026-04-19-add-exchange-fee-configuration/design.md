## Overview

This slice adds versioned exchange fee schedules keyed by currency. Each published schedule defines maker and taker fee rates and an effective time window.

## Data Model

Each fee schedule stores:

- display name
- currency
- maker fee basis points
- taker fee basis points
- effective start timestamp
- optional effective end timestamp
- optional notes
- publish timestamp

## API Shape

- `GET /api/v1/exchange/fees`
  returns active fee schedules, optionally filtered by currency
- `POST /api/v1/internal/exchange/fees`
  publishes a new fee schedule version

## Scope

This slice only publishes fee schedule metadata. It does not yet apply exchange fees to orders, trades, or settlement cashflows.

## Future Work

- fee application during execution and settlement
- historical fee schedule queries by timestamp
- market-specific promotional or zero-fee overrides
