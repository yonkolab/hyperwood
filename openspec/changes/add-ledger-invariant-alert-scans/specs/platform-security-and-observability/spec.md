## ADDED Requirements
### Requirement: Internal ledger invariant scans create alerts
The system MUST provide an internal scan path that detects ledger invariant failures and persists operational alerts for the offending source records.

#### Scenario: Ledger invariant failure triggers alert
- **WHEN** an internal operator runs a ledger invariant scan
- **AND** the scan detects an imbalanced ledger transaction or a negative user wallet balance
- **THEN** the system creates a persisted critical operational alert for each offending source
- **AND** the scan response returns the detected failures and the number of newly created alerts
