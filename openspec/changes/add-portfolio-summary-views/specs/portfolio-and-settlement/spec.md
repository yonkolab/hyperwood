## MODIFIED Requirements

### Requirement: Derived positions and portfolio views
The system SHALL expose portfolio data including cash totals, available balance, reserved balance, resting order value, open positions, fills, transfers, and settlement history.

#### Scenario: Portfolio summary is requested
- **WHEN** an authenticated user requests portfolio data
- **THEN** the system returns current cash balances, reserved funds, open positions, and recent account activity derived from authoritative transaction and execution records

#### Scenario: Fill history is requested
- **WHEN** an authenticated user requests recent fills
- **THEN** the system returns bounded fill history derived from persisted trade records
- **AND** each fill includes market, role, price, quantity, and execution time details

### Requirement: Positions are derived from events
The system MUST derive positions from executions and settlement events rather than treating positions as uncontrolled mutable fields.

#### Scenario: Fill updates position state
- **WHEN** a fill is recorded for a user's order
- **THEN** the system updates the user's derived position for that market and outcome
- **AND** the updated view reflects quantity and average entry price changes
