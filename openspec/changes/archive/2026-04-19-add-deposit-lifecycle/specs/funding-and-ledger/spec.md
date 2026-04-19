## MODIFIED Requirements

### Requirement: Deposit and withdrawal orchestration
The system MUST support deposits and withdrawals across configured rails with pending states, holds, reversals, fraud review states, and provider reconciliation hooks.

#### Scenario: Authenticated user creates a deposit
- **WHEN** an authenticated user submits a deposit request with a verified eligible funding method
- **THEN** the platform records a deposit transfer in a pending state
- **AND** the platform does not credit the user's cash wallet until settlement occurs

#### Scenario: Deposit settles into available cash
- **WHEN** the platform settles a pending deposit
- **THEN** it records the settlement on the append-only ledger
- **AND** it credits the user's cash wallet and debits the platform clearing wallet in the deposit currency
- **AND** subsequent wallet balance reads include the settled amount

#### Scenario: User reads deposit history
- **WHEN** an authenticated user requests deposit history
- **THEN** the platform returns the user's deposits with amounts, currency, funding method references, and lifecycle state
