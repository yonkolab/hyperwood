## MODIFIED Requirements

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

## ADDED Requirements

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
