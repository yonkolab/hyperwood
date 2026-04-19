## MODIFIED Requirements

### Requirement: Market and exchange administration
The system SHALL provide admin workflows for creating and managing events and markets, halting or resuming trading, publishing announcements, and configuring exchange schedules or fee tables.

#### Scenario: Admin publishes a market announcement
- **WHEN** an authorized administrator publishes a market-specific announcement
- **THEN** the system stores the announcement with publisher and timestamp metadata
- **AND** public market clients can retrieve the published announcement history for that market
