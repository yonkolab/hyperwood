## MODIFIED Requirements

### Requirement: Immutable ledger and reservations
The system MUST use an append-only double-entry ledger as the source of truth for wallet balances, reservations, settlements, and transfer adjustments.

#### Scenario: Wallet balance is derived per currency
- **WHEN** the system returns a user's wallet balance
- **THEN** the balance is computed from ledger entries associated with wallet accounts in the requested currency
- **AND** the platform does not collapse multiple currencies into a single unlabeled total

#### Scenario: Reservation uses market currency
- **WHEN** an order is accepted for a market
- **THEN** reserved and position collateral wallet entries are posted in that market's trading currency
- **AND** later fills, releases, and settlements remain in the same currency unless an explicit conversion workflow exists

### Requirement: Deposit and withdrawal orchestration
The system MUST support deposits and withdrawals across configured rails with pending states, holds, reversals, fraud review states, and provider reconciliation hooks.

#### Scenario: Funding rail enforces currency compatibility
- **WHEN** a user links or uses a funding rail
- **THEN** the platform enforces the currencies supported by that rail
- **AND** BRL-native rails such as `pix` operate only against BRL-denominated balances unless an explicit conversion workflow exists
