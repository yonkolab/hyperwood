## MODIFIED Requirements

### Requirement: Derived positions and portfolio views
The system SHALL expose portfolio data including cash totals, available balance, reserved balance, resting order value, open positions, fills, transfers, and settlement history.

#### Scenario: Portfolio summary is requested
- **WHEN** an authenticated user requests portfolio data
- **THEN** the system returns current cash balances, reserved funds, open positions, and recent account activity derived from authoritative transaction and execution records
- **AND** balances and positions are grouped or filtered by currency rather than assumed to be USD

#### Scenario: Multi-currency portfolio avoids synthetic totals
- **WHEN** a user holds balances or positions in BRL and USD
- **THEN** the system reports those amounts in separate currency scopes
- **AND** it does not expose a combined total unless an explicit FX policy defines how that total is calculated
