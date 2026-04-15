## Purpose

Define the administrative and exchange-operations behavior required to manage Hyperwood markets, reviews, announcements, and sensitive operational actions.

## Requirements

### Requirement: Market and exchange administration
The system SHALL provide admin workflows for creating and managing events and markets, halting or resuming trading, publishing announcements, and configuring exchange schedules or fee tables.

#### Scenario: Admin halts a market
- **WHEN** an authorized administrator issues a halt action for a market
- **THEN** the system updates the market to a halted state
- **AND** downstream clients receive the state change through API and streaming channels

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
