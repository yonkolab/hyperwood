## MODIFIED Requirements

### Requirement: Immutable ledger and reservations
The system MUST use an append-only double-entry ledger as the source of truth for wallet balances, reservations, settlements, and transfer adjustments.

#### Scenario: Wallet balance is derived per requested currency
- **WHEN** the system returns a user's wallet balance
- **THEN** the balance is computed from ledger entries associated with wallet accounts in the requested currency
- **AND** the response clearly identifies that currency scope
