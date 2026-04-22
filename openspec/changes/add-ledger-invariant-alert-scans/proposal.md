## Why

Hyperwood already persists operational alerts for reconciliation drift and funding callback delays, but it still lacks a concrete alert source for direct ledger invariant failures. That leaves one of the explicit platform-security requirements only partially implemented.

## What Changes

- add an internal ledger invariant scan endpoint
- detect imbalanced ledger transactions
- detect negative user wallet balances
- persist critical operational alerts for detected failures
- document and test the scan workflow

## Impact

- closes the remaining explicit ledger invariant alerting gap in platform-security-and-observability
- gives operators a deterministic internal scan path instead of depending on indirect reconciliation only
