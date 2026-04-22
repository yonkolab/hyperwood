## MODIFIED Requirements
### Requirement: Review queues for sensitive operations
The system MUST provide operational review workflows for KYC cases, flagged accounts, withdrawal reviews, reconciliation investigations, and settlement retries.

#### Scenario: Resolved market enters settlement retry queue
- **WHEN** a market has been resolved but remains unsettled beyond the configured settlement failure threshold
- **THEN** the system exposes the market in the internal operations review queue with the resolution, timing, and retry context needed for an operator to act

#### Scenario: Operator retries a stalled market settlement
- **WHEN** an authorized internal operator submits a settlement retry for a resolved market that remains unsettled
- **THEN** the system reuses the normal settlement workflow
- **AND** records an audit event for the retry request
- **AND** returns the settlement result or a domain error if the market is not retryable
