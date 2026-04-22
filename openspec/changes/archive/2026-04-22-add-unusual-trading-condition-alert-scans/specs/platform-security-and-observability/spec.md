## ADDED Requirements
### Requirement: Unusual trading condition scans create alerts
The system MUST provide an internal scan path that detects abnormal trading conditions and persists operational alerts for the affected market records.

#### Scenario: Crossed resting book triggers alert
- **WHEN** an internal operator runs a trading-condition scan
- **AND** the scan detects an active market with a crossed resting book where the best bid is greater than or equal to the best ask for the same outcome
- **THEN** the system creates a persisted critical operational alert for that market
- **AND** the scan response returns the detected failures and the number of newly created alerts
