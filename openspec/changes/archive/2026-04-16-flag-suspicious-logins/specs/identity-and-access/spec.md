## MODIFIED Requirements

### Requirement: Strong authenticated access
The system MUST provide session-based authentication for interactive clients and support MFA for sensitive account access, and SHALL record and restrict suspicious login activity according to policy.

#### Scenario: Suspicious login is flagged
- **WHEN** the system detects a login attempt that matches suspicious activity heuristics
- **THEN** the system records the event for review
- **AND** the system applies additional verification or access restrictions according to policy

#### Scenario: Repeated failed logins are temporarily restricted
- **WHEN** recent failed login attempts for the same normalized email or source IP exceed the configured threshold inside the active risk window
- **THEN** the system records the new attempt as suspicious
- **AND** the system rejects the login with a temporary access restriction

#### Scenario: Successful login outcomes remain auditable
- **WHEN** a login succeeds directly or progresses into an MFA challenge
- **THEN** the system records the authentication outcome with the resolved user context when available
- **AND** the event remains available for later review and policy evaluation
