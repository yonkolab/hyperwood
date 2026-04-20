## MODIFIED Requirements

### Requirement: Deposit and withdrawal orchestration
The system MUST support deposits and withdrawals across configured rails with pending states, holds, reversals, fraud review states, and provider reconciliation hooks.

#### Scenario: Provider callback delay is detected
- **WHEN** an internal scan evaluates provider-backed transfers that remain in non-terminal states beyond the configured callback delay threshold
- **THEN** the platform identifies those delayed transfers
- **AND** it records callback delay alerts without duplicating prior alerts for the same transfer
