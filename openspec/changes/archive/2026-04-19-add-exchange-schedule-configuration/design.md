## Overview

This slice adds a single active exchange schedule record that describes normal weekly availability and optional maintenance windows.

## Data Model

The schedule stores:

- display name
- timezone
- weekly windows by weekday
- optional maintenance entries with start, end, and message
- update timestamp

## API Shape

- `GET /api/v1/exchange/schedule`
  returns the active schedule
- `POST /api/v1/internal/exchange/schedule`
  upserts the active schedule

## Scope

This is an exchange-wide schedule only. It does not automatically change market status in this slice. It is a published operating reference for clients and operators.

## Future Work

- fee table configuration
- automated market gating against exchange schedule windows
- historical schedule revisions
