## Purpose

Define the administrative and exchange-operations behavior required to manage Hyperwood markets, reviews, announcements, and sensitive operational actions.
## Requirements
### Requirement: Market and exchange administration
The system SHALL provide admin workflows for creating and managing events and markets, halting or resuming trading, publishing announcements, and configuring exchange schedules or fee tables.

#### Scenario: Admin resumes a halted market
- **WHEN** an authorized administrator issues a resume action for a halted market
- **THEN** the system transitions the market back to an allowed tradable state
- **AND** the state change is preserved as an administrative market transition record

#### Scenario: Admin publishes a market announcement
- **WHEN** an authorized administrator publishes a market-specific announcement
- **THEN** the system stores the announcement with publisher and timestamp metadata
- **AND** public market clients can retrieve the published announcement history for that market

#### Scenario: Admin updates the exchange schedule
- **WHEN** an authorized administrator publishes the active exchange operating schedule
- **THEN** the system stores the configured timezone, weekly windows, and maintenance entries
- **AND** public clients can retrieve the active exchange schedule through a dedicated read endpoint

#### Scenario: Admin publishes an exchange fee schedule
- **WHEN** an authorized administrator publishes an exchange fee schedule for a currency
- **THEN** the system stores maker and taker fee rates with an effective time window
- **AND** public clients can retrieve the active fee schedule for that currency through a dedicated read endpoint

### Requirement: Review queues for sensitive operations
The system MUST provide operational review workflows for KYC cases, flagged accounts, withdrawal reviews, reconciliation investigations, and settlement retries.

#### Scenario: Withdrawal enters admin review queue
- **WHEN** a withdrawal request matches a review policy or manual hold
- **THEN** the system exposes the request in an administrative review queue with supporting risk context

### Requirement: Auditable administrative actions
The system SHALL record immutable audit events for sensitive administrative actions affecting users, balances, markets, or compliance outcomes.

#### Scenario: Sensitive override is audited
- **WHEN** an administrator performs a sensitive action such as withdrawal approval, compliance override, market resolution, or manual ledger adjustment
- **THEN** the system records the actor, action, target resource, relevant payload, and timestamp in audit records

#### Scenario: Audit trail is queried by target
- **WHEN** an internal operator queries audit history for a specific target resource
- **THEN** the system returns matching immutable audit events ordered from newest to oldest
- **AND** each event includes action, actor, target identity, payload, and timestamp

### Requirement: Administrative market resolution actions

The system SHALL provide internal workflows for approving market outcomes and executing settlement.

#### Scenario: Admin resolves a market

- **WHEN** an authorized operator submits an approved market outcome
- **THEN** the system records the actor metadata and evidence context
- **AND** updates the market into its pre-settlement resolved state

#### Scenario: Admin settles a resolved market

- **WHEN** an authorized operator executes settlement for a resolved market
- **THEN** the system applies the settlement exactly once
- **AND** returns a summary of payouts and affected users
