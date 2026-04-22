## MODIFIED Requirements
### Requirement: API and credential security controls
The system MUST support MFA, strong session management, scoped secrets, secret rotation, signed provider webhooks, and rate limiting for external access paths.

#### Scenario: Idle session is rejected
- **WHEN** a bearer session exceeds the configured inactivity timeout
- **THEN** the system rejects further use of that session
- **AND** the session listing surface reflects inactivity expiry information

#### Scenario: Authenticated session activity refreshes last seen time
- **WHEN** a valid bearer session is used on an authenticated endpoint
- **THEN** the system refreshes the session activity timestamp according to policy
