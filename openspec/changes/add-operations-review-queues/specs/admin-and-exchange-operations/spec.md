## ADDED Requirements

### Requirement: Review queues for sensitive operations
The system MUST provide operational review workflows for KYC cases, flagged accounts, withdrawal reviews, reconciliation investigations, and settlement retries.

#### Scenario: Withdrawal review queue is listed
- **WHEN** an operator requests the active review queue
- **THEN** the system returns withdrawals currently awaiting review
- **AND** each item includes the user summary, funding method summary, amount, currency, request timestamp, and review context needed for triage

#### Scenario: Reconciliation investigation queue is listed
- **WHEN** an operator requests the active review queue
- **THEN** the system returns unresolved reconciliation discrepancies
- **AND** each item includes discrepancy severity, run context, transfer context when available, and the persisted investigation message
