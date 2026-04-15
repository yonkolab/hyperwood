## Purpose

Define how Hyperwood authenticates users and API clients, protects account access, and gates trading capabilities behind verified identity and strong access controls.

## Requirements

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

### Requirement: Strong authenticated access
The system MUST provide session-based authentication for interactive clients and support MFA for sensitive account access.

#### Scenario: MFA is enforced for sensitive actions
- **WHEN** a user with MFA enabled signs in or performs a sensitive account action
- **THEN** the system requires successful MFA verification before granting access

#### Scenario: Suspicious login is flagged
- **WHEN** the system detects a login attempt that matches suspicious activity heuristics or device fingerprint risk rules
- **THEN** the system records the event for review
- **AND** the system applies additional verification or access restrictions according to policy

### Requirement: API trading credentials
The system SHALL allow advanced users to create and manage API keys with explicit scopes and account-level limits.

#### Scenario: API key is created with scopes
- **WHEN** an eligible authenticated user creates an API key
- **THEN** the system stores the credential with explicit scopes and account ownership metadata
- **AND** the system exposes the secret only at creation time

#### Scenario: API key request exceeds account policy
- **WHEN** an API client uses a key outside its granted scope or rate-limit profile
- **THEN** the system rejects the request
- **AND** the system records the policy violation in audit logs
