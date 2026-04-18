## MODIFIED Requirements

### Requirement: Derived positions and portfolio views
The system SHALL expose portfolio data including cash totals, available balance, reserved balance, resting order value, open positions, fills, transfers, and settlement history.

#### Scenario: Portfolio summary is requested
- **WHEN** an authenticated user requests portfolio data for a currency scope
- **THEN** the system returns balances, positions, fills, and activity filtered to that currency
- **AND** the response identifies the requested currency
