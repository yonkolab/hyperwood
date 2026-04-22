## ADDED Requirements

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

#### Scenario: Deposit enters pending state
- **WHEN** a deposit request is accepted by the platform but external settlement is not final
- **THEN** the system records the transfer in a pending state
- **AND** the funds are not treated as fully available cash until settlement policy allows it

#### Scenario: Withdrawal requires review
- **WHEN** a withdrawal request matches a configured review threshold or risk rule
- **THEN** the system places the withdrawal into a review state
- **AND** the system blocks payout completion until the review is resolved

### Requirement: Immutable ledger and reservations
The system MUST use an append-only double-entry ledger as the source of truth for wallet balances, reservations, settlements, and transfer adjustments.

#### Scenario: Order acceptance reserves cash
- **WHEN** an order is accepted for book entry
- **THEN** the system records ledger-backed reservation state for the required funds
- **AND** the user's available balance reflects the reservation without mutating ledger history destructively

#### Scenario: Reservation is released on cancellation
- **WHEN** a reserved order is canceled or reduced
- **THEN** the system records compensating ledger effects and reservation updates
- **AND** the released amount returns to the user's available balance

### Requirement: Reconciliation workflows
The system SHALL run intraday and daily reconciliation against providers, transfer states, reservations, ledger invariants, and settlement outputs.

#### Scenario: Reconciliation mismatch is detected
- **WHEN** a reconciliation job finds a mismatch between internal records and an authoritative external or ledger-backed source
- **THEN** the system records the discrepancy
- **AND** the system raises an operational alert for investigation
