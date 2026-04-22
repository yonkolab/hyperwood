## ADDED Requirements

### Requirement: Derived positions and portfolio views
The system SHALL expose portfolio data including cash totals, available balance, reserved balance, resting order value, open positions, fills, transfers, and settlement history.

#### Scenario: Portfolio summary is requested
- **WHEN** an authenticated user requests portfolio data
- **THEN** the system returns current cash balances, reserved funds, open positions, and recent account activity derived from authoritative transaction and execution records

### Requirement: Positions are derived from events
The system MUST derive positions from executions and settlement events rather than treating positions as uncontrolled mutable fields.

#### Scenario: Fill updates position state
- **WHEN** a fill is recorded for a user's order
- **THEN** the system updates the user's derived position for that market and outcome
- **AND** the updated view reflects quantity and average entry price changes

### Requirement: Market resolution workflow
The system SHALL support resolution workflows with primary and fallback sources, cutoff rules, evidence artifacts, reviewer identity, and approval-chain metadata.

#### Scenario: Market enters awaiting settlement after approval
- **WHEN** authorized reviewers approve a market resolution outcome
- **THEN** the system records the approved evidence and resolution decision
- **AND** the market transitions to a pre-settlement resolved state

#### Scenario: Dispute blocks final settlement
- **WHEN** a market enters a disputed state before settlement finalization
- **THEN** the system prevents final settlement execution until the dispute workflow is resolved

### Requirement: Settlement updates financial state
The system MUST freeze trading on a resolved market, calculate winning and losing outcomes, emit settlement events, and post payout effects through the ledger.

#### Scenario: Settlement completes
- **WHEN** settlement executes successfully for a resolved market
- **THEN** the system records settlement outputs, updates balances and positions, and exposes the settlement through user-facing APIs
