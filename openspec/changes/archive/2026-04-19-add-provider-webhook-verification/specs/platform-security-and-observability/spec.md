## MODIFIED Requirements

### Requirement: API and credential security controls
The system MUST support MFA, strong session management, scoped secrets, secret rotation, signed provider webhooks, and rate limiting for external access paths.

#### Scenario: Signed funding webhook is verified
- **WHEN** a funding provider callback is received on the signed webhook endpoint
- **THEN** the system validates the timestamped HMAC signature before applying transfer side effects
- **AND** invalid signatures are rejected and logged with request correlation data
