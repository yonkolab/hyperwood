## MODIFIED Requirements

### Requirement: Invariant and outage alerting
The system MUST alert operators on balance invariant failures, settlement failures, reconciliation drift, callback delays, websocket outages, and unusual trading conditions.

#### Scenario: Reconciliation drift creates an operational alert
- **WHEN** reconciliation records a critical discrepancy such as a missing internal transfer, a status mismatch, or a ledger invariant violation
- **THEN** the system creates a persisted operational alert linked to that source record
- **AND** operators can query the alert through an internal operations endpoint
