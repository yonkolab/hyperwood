## MODIFIED Requirements

### Requirement: Deposit and withdrawal orchestration
The system MUST support deposits and withdrawals across configured rails with pending states, holds, reversals, fraud review states, and provider reconciliation hooks.

#### Scenario: Authenticated user creates a withdrawal
- **WHEN** an authenticated user submits a withdrawal request with a verified eligible funding method
- **THEN** the platform records a withdrawal transfer
- **AND** it moves the requested amount out of available cash into a dedicated user withdrawal hold balance in the same currency

#### Scenario: Withdrawal requires review
- **WHEN** a withdrawal request matches the configured review threshold
- **THEN** the transfer enters `in_review`
- **AND** payout settlement remains blocked until review approval occurs

#### Scenario: Withdrawal fails before payout
- **WHEN** the platform fails or rejects a held withdrawal
- **THEN** it records the transfer failure reason
- **AND** it returns the held amount back to available cash through the ledger

#### Scenario: Withdrawal settles
- **WHEN** the platform settles a pending approved withdrawal
- **THEN** it debits the user withdrawal hold wallet
- **AND** it credits the platform clearing wallet in the same currency
- **AND** subsequent wallet and portfolio reads reflect the reduced user total
