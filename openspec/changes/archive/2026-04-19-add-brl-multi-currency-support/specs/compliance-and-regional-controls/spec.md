## MODIFIED Requirements

### Requirement: Regional access controls
The system SHALL enforce policy-driven restrictions by country, jurisdiction, legal entity, and funding method.

#### Scenario: Brazil user receives BRL-compatible rails
- **WHEN** a user with a Brazil-compatible compliance profile queries available funding methods
- **THEN** the system may return BRL-native methods such as `pix`
- **AND** those methods are constrained to BRL-denominated funding flows unless an explicit conversion workflow exists

#### Scenario: Rail availability varies by region and currency
- **WHEN** a user queries available funding methods
- **THEN** the system returns only the methods allowed for that user's compliance profile, region, and requested currency
