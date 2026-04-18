## MODIFIED Requirements

### Requirement: Funding method registry
The system SHALL maintain linked funding methods with ownership verification, provider references, rail type, status, and regional availability constraints.

#### Scenario: Linked funding method is added
- **WHEN** a user successfully links an eligible debit card, bank account, wire profile, or crypto wallet
- **THEN** the system stores the method with verification and provider metadata
- **AND** the method becomes available only if policy checks pass

#### Scenario: Unverified method cannot be used
- **WHEN** a linked funding method has not completed required ownership or provider verification
- **THEN** the system prevents deposits or withdrawals through that method

### Requirement: Immutable ledger and reservations
The system MUST use an append-only double-entry ledger as the source of truth for wallet balances, reservations, settlements, and transfer adjustments.

#### Scenario: Wallet balance is derived from append-only ledger entries
- **WHEN** the system returns a user's wallet balance
- **THEN** the balance is computed from ledger entries associated with that wallet account
- **AND** the platform does not mutate historical ledger entries destructively
