## Why

The trading spec already calls for decrease and amendment workflows, but the current API only supports create and cancel. Users cannot reduce resting exposure or improve a resting limit order without cancelling and resubmitting.

## What Changes

- add authenticated order amendment support for resting limit orders
- support decrease-in-quantity and limit price amendment
- recompute reserved collateral and apply release or top-up ledger movements
- document and test the amendment workflow

## Impact

- users can reduce remaining exposure without losing already-filled quantity
- users can amend resting limit orders without a cancel-and-recreate round trip
- downstream market command sequencing now captures amendment events
