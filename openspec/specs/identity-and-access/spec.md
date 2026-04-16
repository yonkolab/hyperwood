## Purpose

Define how Hyperwood authenticates users and API clients, protects account access, and gates trading capabilities behind verified identity and strong access controls.
## Requirements
### Requirement: Day-1 access hardening
The system MUST enforce strong identity verification and access control before any production trading or privileged API capability is made available on Hyperwood.

#### Scenario: Production trading is gated by verified access controls
- **WHEN** Hyperwood prepares a day-1 production release for trading users or API clients
- **THEN** the system exposes those capabilities only to accounts that satisfy the required verification and authentication controls
- **AND** unauthenticated, unverified, or non-compliant access remains blocked

### Requirement: User account onboarding
The system SHALL support user registration, email verification, and account activation workflows for Hyperwood users before they access trading functions.

#### Scenario: Account registration succeeds
- **WHEN** a user submits a valid registration request with required profile fields
- **THEN** the system creates the user in a pending verification state
- **AND** the system issues a verification challenge to the supplied email address

#### Scenario: Trading is blocked before verification
- **WHEN** an unverified user attempts to access authenticated trading capabilities
- **THEN** the system rejects the request
- **AND** the system returns an account verification requirement

### Requirement: Identity can link to an existing user
The system MUST support linking new authentication credentials to an existing Hyperwood user record without creating a duplicate user.

#### Scenario: Password identity is linked to an existing user
- **WHEN** an authorized flow links a password-based identity to an existing user record
- **THEN** the system creates a new identity record associated with that user
- **AND** the system preserves the original user identifier and account history

#### Scenario: Duplicate user creation is prevented during linking
- **WHEN** an identity-linking flow resolves to an existing Hyperwood user
- **THEN** the system links the credential to that user instead of creating a second user record

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

### Requirement: API trading credentials
The system SHALL allow advanced users to create and manage API keys with explicit scopes and account-level limits.

#### Scenario: API key creation is gated by MFA when enabled
- **WHEN** a user with an active MFA factor attempts to create an API key
- **THEN** the system requires a valid MFA authorization for API key management before creating the credential

#### Scenario: API key revocation is gated by MFA when enabled
- **WHEN** a user with an active MFA factor attempts to revoke an API key
- **THEN** the system requires a valid MFA authorization for API key management before revoking the credential

