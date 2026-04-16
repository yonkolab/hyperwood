## MODIFIED Requirements

### Requirement: API trading credentials
The system SHALL allow advanced users to create and manage API keys with explicit scopes and account-level limits, and SHALL authenticate non-interactive API clients with those keys on protected API routes using raw API keys or HMAC-signed requests.

#### Scenario: API key is created with scopes
- **WHEN** an eligible authenticated user creates an API key
- **THEN** the system stores the credential with explicit scopes and account ownership metadata
- **AND** the system exposes the secret only at creation time

#### Scenario: API key request exceeds account policy
- **WHEN** an API client uses a key outside its granted scope or rate-limit profile
- **THEN** the system rejects the request
- **AND** the system records the policy violation in audit logs

#### Scenario: API key authenticates a protected route
- **WHEN** an API client sends a valid non-revoked API key to a protected route
- **THEN** the system authenticates the owning user context
- **AND** the system updates usage metadata for that API key

#### Scenario: HMAC-signed request authenticates a protected route
- **WHEN** an API client sends a valid HMAC-signed request with a non-revoked API key identifier, a valid timestamp, and a correct signature
- **THEN** the system authenticates the owning user context
- **AND** the protected route is executed only if the required scopes are satisfied

#### Scenario: Replayed HMAC request is rejected
- **WHEN** an API client reuses the same HMAC nonce for the same API key within the accepted verification window
- **THEN** the system rejects the request as a replay attempt
- **AND** the protected route is not executed

#### Scenario: Revoked API key is rejected
- **WHEN** an API client sends a revoked API key
- **THEN** the system rejects the request
- **AND** the protected route is not executed
