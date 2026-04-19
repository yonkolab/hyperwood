## Purpose

Define how Hyperwood links funding methods, orchestrates money movement, preserves ledger integrity, and reconciles financial state across internal and external systems.
## Requirements
### Requirement: Funding method registry
The system SHALL maintain linked funding methods with ownership verification, provider references, rail type, status, and regional availability constraints.

#### Scenario: Linked funding method is added
- **WHEN** a user successfully links an eligible debit card, bank account, wire profile, or crypto wallet
- **THEN** the system stores the method with verification and provider metadata
- **AND** the method becomes available only if policy checks pass

#### Scenario: Unverified method cannot be used
- **WHEN** a linked funding method has not completed required ownership or provider verification
- **THEN** the system prevents deposits or withdrawals through that method

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

### Requirement: Immutable ledger and reservations
The system MUST use an append-only double-entry ledger as the source of truth for wallet balances, reservations, settlements, and transfer adjustments.

#### Scenario: Wallet balance is derived per requested currency
- **WHEN** the system returns a user's wallet balance
- **THEN** the balance is computed from ledger entries associated with wallet accounts in the requested currency
- **AND** the response clearly identifies that currency scope

### Requirement: Reconciliation workflows
The system SHALL run intraday and daily reconciliation against providers, transfer states, reservations, ledger invariants, and settlement outputs.

#### Scenario: Funding reconciliation run is executed
- **WHEN** the platform runs reconciliation against an authoritative set of funding transfer states
- **THEN** it records a reconciliation run with compared record counts and discrepancy counts
- **AND** each detected issue is persisted as a discrepancy linked to that run

#### Scenario: Reconciliation detects transfer state mismatch
- **WHEN** an authoritative transfer snapshot disagrees with the internal transfer state or the transfer is missing internally
- **THEN** the platform records a discrepancy describing the mismatch
- **AND** operations can query the discrepancy later

#### Scenario: Reconciliation detects ledger invariant failure
- **WHEN** a transfer's internal status implies a required ledger transaction and that transaction is missing
- **THEN** the platform records a ledger invariant discrepancy
- **AND** the discrepancy is marked with critical severity

