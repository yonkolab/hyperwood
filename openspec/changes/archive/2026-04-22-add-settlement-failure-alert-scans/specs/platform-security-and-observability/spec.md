## ADDED Requirements
### Requirement: Settlement failure scans create alerts
The system MUST provide an internal scan path that detects resolved markets stalled before settlement and persists operational alerts for the affected market records.

#### Scenario: Settlement failure triggers alert
- **WHEN** an internal operator runs a settlement failure scan
- **AND** the scan detects a resolved market that has exceeded the configured settlement failure threshold without a settlement record
- **THEN** the system creates a persisted critical operational alert for that market
- **AND** the scan response returns the detected failures and the number of newly created alerts
