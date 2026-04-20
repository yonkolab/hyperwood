## MODIFIED Requirements

### Requirement: Invariant and outage alerting
The system MUST alert operators on balance invariant failures, settlement failures, reconciliation drift, callback delays, websocket outages, and unusual trading conditions.

#### Scenario: Funding callback delay triggers alert
- **WHEN** monitoring detects a provider-backed funding transfer that has exceeded the configured callback delay threshold without reaching a terminal state
- **THEN** the system creates a persisted operational alert linked to that transfer
- **AND** operators can query the alert through an internal operations endpoint
