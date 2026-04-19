## Why

Hyperwood now detects critical reconciliation and ledger-invariant failures, but those failures only exist as discrepancy records. There is still no first-class operational alert feed that lets operators poll active incidents.

## What Changes

- Add persisted operational alerts for critical platform failures.
- Generate alerts from critical funding reconciliation discrepancies.
- Add an internal operations alert listing endpoint.
- Document the alert surface and add API coverage.

## Impact

- Critical reconciliation drift becomes visible as an operational alert, not just a discrepancy row.
- The platform security spec gains an executable invariant alerting surface.
- Later slices can reuse the same alert model for settlement failures, callback delays, and realtime outages.
