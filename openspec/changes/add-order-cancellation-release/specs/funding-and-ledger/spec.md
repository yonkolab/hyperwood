## MODIFIED Requirements

### Requirement: Immutable ledger and reservations
The system MUST use an append-only double-entry ledger as the source of truth for wallet balances, reservations, settlements, and transfer adjustments.

#### Scenario: Wallet balance is derived from append-only ledger entries
- **WHEN** the system returns a user's wallet balance
- **THEN** the balance is computed from ledger entries associated with the user's available and reserved wallet accounts
- **AND** the platform does not mutate historical ledger entries destructively

#### Scenario: Order acceptance reserves collateral in the ledger
- **WHEN** an order is accepted for downstream matching
- **THEN** the system records compensating ledger entries that move the order's maximum-loss collateral from available cash into reserved cash
- **AND** repeated idempotent retries do not create duplicate reservation transfers

#### Scenario: Order cancellation releases collateral in the ledger
- **WHEN** a resting order is cancelled successfully
- **THEN** the system records compensating ledger entries that move the order's reserved collateral from reserved cash back into available cash
- **AND** repeated cancellation retries do not create duplicate release transfers
