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
The system SHALL support user registration, email verification, transactional verification email delivery, and account activation workflows for Hyperwood users before they access trading functions.

#### Scenario: Account registration succeeds
- **WHEN** a user submits a valid registration request with required profile fields
- **THEN** the system creates the user in a pending verification state
- **AND** the system issues a verification challenge to the supplied email address

#### Scenario: Verification email is dispatched for a new account
- **WHEN** a new account registration succeeds in a production environment
- **THEN** the system dispatches a transactional verification email through the configured delivery provider
- **AND** the response indicates that verification delivery was accepted for processing

#### Scenario: Verification email can be resent
- **WHEN** a pending user requests a verification email resend
- **THEN** the system issues a fresh verification challenge according to policy
- **AND** the system dispatches a new transactional verification email through the configured delivery provider

#### Scenario: Local development can expose the verification token directly
- **WHEN** the platform runs in a non-production development mode
- **THEN** the verification response may expose the raw verification token for local testing
- **AND** that override does not replace provider-backed delivery requirements for production

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
The system MUST provide session-based authentication for interactive clients, support MFA for sensitive account access, record and restrict suspicious login activity according to policy, maintain a documented inventory of route access classes for public, user, API-key, and internal surfaces, and resolve protected route auth through shared guard middleware instead of per-route token parsing.

#### Scenario: Route access inventory is published
- **WHEN** contributors review the authenticated API surface
- **THEN** the system provides a route inventory grouped by module
- **AND** each route is classified into its current access class

#### Scenario: Internal route model is documented
- **WHEN** contributors review internal operator routes
- **THEN** the inventory states that current internal access is protected by the bootstrap token
- **AND** the inventory distinguishes that current model from future per-operator RBAC

#### Scenario: Session guard resolves authenticated user context
- **WHEN** a session-protected route executes
- **THEN** shared guard middleware validates the bearer token once
- **AND** attaches the resolved user context to the request before the handler runs

#### Scenario: Internal guard resolves current internal auth model
- **WHEN** an internal route executes
- **THEN** shared guard middleware validates the bootstrap token once
- **AND** attaches internal auth context to the request before the handler runs

#### Scenario: MFA step-up token is standardized on the request
- **WHEN** a session-protected route requires a step-up action token
- **THEN** shared guard middleware captures the optional MFA authorization header
- **AND** exposes the action context on the request without changing downstream domain rules

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

### Requirement: Transactional verification delivery lifecycle
The system MUST treat verification mail as a transactional delivery workflow with provider-backed dispatch and persisted delivery attempts.

#### Scenario: Verification delivery attempt is recorded
- **WHEN** the platform dispatches a verification email
- **THEN** the system records a delivery attempt with the normalized recipient, message type, and current delivery status
- **AND** provider delivery metadata is attached when available

#### Scenario: Verification delivery failure is surfaced
- **WHEN** the platform cannot hand off a verification email to the configured provider
- **THEN** the system records the failure result for later inspection
- **AND** the caller receives a delivery failure outcome according to policy

### Requirement: Internal operator authorization foundation
The system MUST define a phased authorization model for internal operator access so that bootstrap-token-only protection can be replaced with per-operator identities and route-family permissions without breaking existing internal workflows during migration.

#### Scenario: Bootstrap compatibility remains available during migration
- **WHEN** the platform begins migrating internal routes to operator auth
- **THEN** the current bootstrap-token model remains compatible during the transition phase
- **AND** the shared internal guard abstraction hides whether the caller is bootstrap-authenticated or operator-authenticated

#### Scenario: Internal route family maps to operator permission
- **WHEN** the platform introduces first-class operator identities
- **THEN** each internal route family has an explicit permission mapping
- **AND** permission checks are evaluated before the internal handler executes

#### Scenario: Operator principal receives a scoped token
- **WHEN** the platform creates an operator principal and issues an operator token
- **THEN** the token resolves to one operator identity with assigned roles
- **AND** the effective internal permissions are derived from those roles before route access is granted
