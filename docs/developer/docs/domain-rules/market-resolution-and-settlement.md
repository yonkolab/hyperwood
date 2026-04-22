---
title: Market Resolution and Settlement Rules
---

# Market Resolution and Settlement Rules

Resolution and settlement are separate operational steps.

## Resolution

- records the approved outcome
- stores evidence context
- changes the market into a pre-settlement resolved state

## Settlement

- computes payouts
- applies collateral release and cash movement
- creates settlement artifacts exactly once
- can be retried through internal operations if a resolved market stalls

## Operator implications

- announcements, status changes, resolution, and settlement are all internal actions
- sensitive actions should remain auditable
