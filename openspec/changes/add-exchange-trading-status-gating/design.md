## Overview

This slice turns the active exchange schedule into an operational gate for trading activity.

## Derived Status

The exchange status is derived from the current time and the active schedule:

- `open` when the current local time falls within a configured weekly window and no maintenance window is active
- `maintenance` when an active maintenance window covers the current time
- `closed` when the current local time is outside configured weekly windows

Maintenance takes precedence over weekly trading windows.

## API Shape

- `GET /api/v1/exchange/status`
  returns the current derived exchange status and supporting schedule context

## Enforcement

- `POST /api/v1/orders` rejects new orders when the exchange is not open
- `POST /api/v1/internal/markets/:marketId/match` rejects matching when the exchange is not open

## Scope

This slice does not automatically rewrite market statuses. Markets remain individually controlled, but exchange-wide scheduling now gates whether trading activity can proceed.

## Future Work

- automatic market state synchronization with exchange status
- historical exchange status snapshots
- schedule exceptions for specific market categories or regions
