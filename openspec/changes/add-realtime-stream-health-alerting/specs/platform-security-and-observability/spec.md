## ADDED Requirements
### Requirement: Realtime stream health scans create alerts
The system MUST provide an internal scan path that detects stale realtime stream subscriptions and persists operational alerts for affected stream records.

#### Scenario: Stale realtime stream triggers alert
- **WHEN** an internal operator runs a realtime stream health scan
- **AND** the scan detects a public or private realtime subscription whose last delivery exceeds the configured staleness threshold
- **THEN** the system creates a persisted critical operational alert for that subscription
- **AND** the scan response returns the stale stream details and the number of newly created alerts
