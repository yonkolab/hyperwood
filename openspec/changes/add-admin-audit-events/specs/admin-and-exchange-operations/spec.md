## MODIFIED Requirements

### Requirement: Auditable administrative actions
The system SHALL record immutable audit events for sensitive administrative actions affecting users, balances, markets, or compliance outcomes.

#### Scenario: Audit trail is queried by target
- **WHEN** an internal operator queries audit history for a specific target resource
- **THEN** the system returns matching immutable audit events ordered from newest to oldest
- **AND** each event includes action, actor, target identity, payload, and timestamp
