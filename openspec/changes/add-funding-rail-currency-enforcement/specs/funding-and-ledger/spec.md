## MODIFIED Requirements

### Requirement: Deposit and withdrawal orchestration
The system MUST support deposits and withdrawals across configured rails with pending states, holds, reversals, fraud review states, and provider reconciliation hooks.

#### Scenario: Funding methods are filtered by requested currency
- **WHEN** an authenticated user requests eligible funding methods for a currency
- **THEN** the platform returns only verified linked methods whose rails support that currency
- **AND** each returned method includes the currencies that rail supports

#### Scenario: Funding method registration rejects incompatible country and rail pairs
- **WHEN** the platform attempts to register a funding method
- **THEN** it rejects rail-country combinations that are outside the configured regional policy
- **AND** incompatible methods are not persisted
