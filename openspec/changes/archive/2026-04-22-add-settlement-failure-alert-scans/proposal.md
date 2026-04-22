## Why

Hyperwood already alerts on reconciliation drift, callback delays, and direct ledger invariant failures. One remaining explicit platform-security gap is settlement failure alerting for markets that were resolved but did not progress to settlement within an operational threshold.

## What Changes

- add an internal settlement failure scan endpoint
- detect resolved markets still awaiting settlement past a configured threshold
- persist critical operational alerts for affected markets
- document and test the scan workflow

## Impact

- closes the market settlement failure alerting gap in platform-security-and-observability
- gives operators a deterministic internal scan path for stalled settlements
