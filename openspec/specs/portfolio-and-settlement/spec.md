## Purpose

Define how Hyperwood derives portfolio state, manages market resolution, and applies settlement outcomes to positions and balances.
## Requirements
### Requirement: Derived positions and portfolio views
The system SHALL expose portfolio data including cash totals, available balance, reserved balance, resting order value, open positions, fills, transfers, and settlement history.

#### Scenario: Portfolio summary is requested
- **WHEN** an authenticated user requests portfolio data for a currency scope
- **THEN** the system returns balances, positions, fills, and activity filtered to that currency
- **AND** the response identifies the requested currency

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

### Requirement: Market resolution approval

The system SHALL record approved market resolution decisions before settlement executes.

#### Scenario: Market enters awaiting settlement after approval

- **WHEN** an authorized operator approves a market outcome with evidence
- **THEN** the system records the approved outcome and evidence metadata
- **AND** the market transitions to `awaiting_resolution`

### Requirement: Settlement consumes collateral and credits final cash

The system MUST settle matched positions from position collateral into user cash according to the approved resolution outcome.

#### Scenario: Binary market settles to a winning outcome

- **WHEN** settlement executes for a market resolved to `yes` or `no`
- **THEN** the system debits each participant's position collateral for that market
- **AND** credits final payout only to positions whose normalized outcome matches the resolved outcome
- **AND** records the settlement in user-facing APIs

#### Scenario: Void settlement refunds cost basis

- **WHEN** settlement executes for a market resolved as `void`
- **THEN** the system refunds each matched position's cost basis back to user cash
- **AND** marks the market as `voided`

