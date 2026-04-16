## MODIFIED Requirements

### Requirement: Strong authenticated access
The system MUST provide session-based authentication for interactive clients and support MFA for sensitive account access, including step-up verification for sensitive in-session account actions.

#### Scenario: MFA is enforced for sensitive actions
- **WHEN** a user with MFA enabled signs in or performs a sensitive account action
- **THEN** the system requires successful MFA verification before granting access

#### Scenario: Sensitive action receives a short-lived MFA authorization
- **WHEN** an authenticated user with an active MFA factor successfully verifies a TOTP code for a sensitive action
- **THEN** the system issues a short-lived authorization token bound to that user and action
- **AND** the token can be consumed by the protected route only within its validity window

#### Scenario: Sensitive action is rejected without valid MFA authorization
- **WHEN** a user with an active MFA factor attempts a protected sensitive action without a valid unexpired authorization token for that action
- **THEN** the system rejects the request
- **AND** the sensitive action is not executed

### Requirement: API trading credentials
The system SHALL allow advanced users to create and manage API keys with explicit scopes and account-level limits.

#### Scenario: API key creation is gated by MFA when enabled
- **WHEN** a user with an active MFA factor attempts to create an API key
- **THEN** the system requires a valid MFA authorization for API key management before creating the credential

#### Scenario: API key revocation is gated by MFA when enabled
- **WHEN** a user with an active MFA factor attempts to revoke an API key
- **THEN** the system requires a valid MFA authorization for API key management before revoking the credential
