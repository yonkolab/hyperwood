## MODIFIED Requirements

### Requirement: Market and exchange administration
The system SHALL provide admin workflows for creating and managing events and markets, halting or resuming trading, publishing announcements, and configuring exchange schedules or fee tables.

#### Scenario: Admin publishes an exchange fee schedule
- **WHEN** an authorized administrator publishes an exchange fee schedule for a currency
- **THEN** the system stores maker and taker fee rates with an effective time window
- **AND** public clients can retrieve the active fee schedule for that currency through a dedicated read endpoint
