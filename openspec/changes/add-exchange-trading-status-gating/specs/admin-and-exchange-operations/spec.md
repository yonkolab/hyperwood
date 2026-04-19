## MODIFIED Requirements

### Requirement: Market and exchange administration
The system SHALL provide admin workflows for creating and managing events and markets, halting or resuming trading, publishing announcements, and configuring exchange schedules or fee tables.

#### Scenario: Exchange status is derived from the active schedule
- **WHEN** a client requests the current exchange status
- **THEN** the system derives whether the exchange is open, closed, or in maintenance from the active schedule and current time
- **AND** the response includes enough schedule context for clients to explain the status

#### Scenario: Order entry is blocked while the exchange is closed
- **WHEN** a user submits a new order while the exchange is outside scheduled hours or under maintenance
- **THEN** the system rejects the order with an exchange-level not-open error

#### Scenario: Matching is blocked while the exchange is closed
- **WHEN** an internal matching run is triggered while the exchange is outside scheduled hours or under maintenance
- **THEN** the system rejects the matching run with an exchange-level not-open error
