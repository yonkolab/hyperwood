## MODIFIED Requirements

### Requirement: Market and exchange administration
The system SHALL provide admin workflows for creating and managing events and markets, halting or resuming trading, publishing announcements, and configuring exchange schedules or fee tables.

#### Scenario: Admin updates the exchange schedule
- **WHEN** an authorized administrator publishes the active exchange operating schedule
- **THEN** the system stores the configured timezone, weekly windows, and maintenance entries
- **AND** public clients can retrieve the active exchange schedule through a dedicated read endpoint
