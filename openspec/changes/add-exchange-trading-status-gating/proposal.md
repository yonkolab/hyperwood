## Why

Exchange schedule configuration currently acts only as published metadata. The platform still accepts new orders and can continue matching while the exchange is outside scheduled trading hours or under maintenance.

## What Changes

- add a derived public exchange status endpoint
- derive open, closed, and maintenance status from the active exchange schedule
- block new order entry when the exchange is not open
- block internal matching when the exchange is not open
- document and test the new behavior

## Impact

- published schedules now have operational effect
- clients can reliably distinguish normal closure from active maintenance
- operators get a single scheduling control that gates trading activity without manually halting every market
