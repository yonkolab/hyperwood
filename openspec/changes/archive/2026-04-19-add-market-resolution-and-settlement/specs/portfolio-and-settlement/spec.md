## ADDED Requirements

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
