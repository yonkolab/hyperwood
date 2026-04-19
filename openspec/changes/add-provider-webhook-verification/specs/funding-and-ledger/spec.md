## MODIFIED Requirements

### Requirement: Deposit and withdrawal orchestration
The system MUST support deposits and withdrawals across configured rails with pending states, holds, reversals, fraud review states, and provider reconciliation hooks.

#### Scenario: Provider webhook advances a funding transfer
- **WHEN** a verified provider webhook reports a supported state change for a known funding transfer
- **THEN** the platform applies the matching internal transfer transition
- **AND** it preserves ledger correctness for any resulting cash movement

#### Scenario: Provider webhook is replayed
- **WHEN** the same provider and event ID are received again after successful processing
- **THEN** the platform acknowledges the callback without replaying side effects
- **AND** the existing processed webhook record remains the idempotency source of truth
