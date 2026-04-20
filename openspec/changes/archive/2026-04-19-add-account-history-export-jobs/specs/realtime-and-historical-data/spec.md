## MODIFIED Requirements

### Requirement: Historical exports and retention
The system MUST support archival policies, historical exports, and retained order book or candlestick data suitable for compliance and analytics use cases.

#### Scenario: User requests account history export
- **WHEN** an authenticated user requests an account history export for a supported currency
- **THEN** the system creates an export job and completes it with a persisted artifact
- **AND** the user can retrieve the resulting artifact through an authenticated historical export path
