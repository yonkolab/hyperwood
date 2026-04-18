## MODIFIED Requirements

### Requirement: Derived positions and portfolio views
The system SHALL expose portfolio data including cash totals, available balance, reserved balance, resting order value, open positions, fills, transfers, and settlement history.

#### Scenario: Portfolio summary is requested
- **WHEN** an authenticated user requests portfolio data
- **THEN** the system returns current cash balances, reserved funds, open positions, and recent account activity derived from authoritative transaction and execution records
- **AND** matched-but-unsettled collateral is reported separately from resting order reserve
