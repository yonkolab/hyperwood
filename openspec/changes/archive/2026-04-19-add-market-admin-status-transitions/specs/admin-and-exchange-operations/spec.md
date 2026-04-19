## MODIFIED Requirements

### Requirement: Market and exchange administration
The system SHALL provide admin workflows for creating and managing events and markets, halting or resuming trading, publishing announcements, and configuring exchange schedules or fee tables.

#### Scenario: Admin resumes a halted market
- **WHEN** an authorized administrator issues a resume action for a halted market
- **THEN** the system transitions the market back to an allowed tradable state
- **AND** the state change is preserved as an administrative market transition record
