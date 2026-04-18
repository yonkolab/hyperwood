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

#### Scenario: Match reclassifies resting reserve
- **WHEN** an order fill occurs
- **THEN** the system debits the consumed amount from the user's resting order reserve wallet
- **AND** it credits the matched exposure to a dedicated user position collateral wallet
- **AND** any price-improvement excess is credited back to available cash through the same append-only ledger model

### Requirement: Reconciliation workflows
The system SHALL run intraday and daily reconciliation against providers, transfer states, reservations, ledger invariants, and settlement outputs.

#### Scenario: Reconciliation mismatch is detected
- **WHEN** a reconciliation job finds a mismatch between internal records and an authoritative external or ledger-backed source
- **THEN** the system records the discrepancy
- **AND** the system raises an operational alert for investigation

