## MODIFIED Requirements

### Requirement: Regional access controls
The system SHALL enforce policy-driven restrictions by country, jurisdiction, legal entity, and funding method.

#### Scenario: Funding method discovery varies by region and currency
- **WHEN** an authenticated user requests eligible funding methods for a currency
- **THEN** the platform evaluates both the user's region policy and the requested currency
- **AND** only rails permitted for that region and currency are returned
