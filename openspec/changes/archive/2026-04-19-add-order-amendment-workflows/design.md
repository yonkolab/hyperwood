## Overview

This slice adds authenticated amendments for currently resting limit orders. Amendments can:

- decrease total order quantity, as long as the new total stays above already-filled quantity
- update the limit price for the remaining resting quantity

## Reserve Handling

The system recomputes reserve from the amended remaining quantity and amended limit price.

- if the new reserve is lower, excess collateral is released back to available cash
- if the new reserve is higher, available cash is checked and additional collateral is reserved

## Scope

- applies only to `queued_for_matching` and `partially_filled` limit orders
- does not support increasing total quantity
- does not support amending already-filled or cancelled orders
- does not add idempotency semantics in this slice

## Future Work

- explicit decrease-only endpoint if clients need a narrower workflow
- idempotent order amendments
- replace-in-book semantics for time priority once a more explicit order book model exists
