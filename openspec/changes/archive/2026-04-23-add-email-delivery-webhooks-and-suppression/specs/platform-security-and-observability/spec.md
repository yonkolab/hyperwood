## MODIFIED Requirements

### Requirement: API and credential security controls
The system MUST support MFA, strong session management, scoped secrets, secret rotation, signed provider webhooks, signed email-provider webhooks, and rate limiting for external access paths.

#### Scenario: Signed webhook is verified
- **WHEN** a provider callback is received on a signed webhook endpoint
- **THEN** the system verifies the signature before applying side effects
- **AND** invalid signatures are rejected and logged

#### Scenario: Signed email-provider webhook is verified
- **WHEN** an email delivery provider callback is received on the signed webhook endpoint
- **THEN** the system validates the provider signature before applying delivery-event side effects
- **AND** invalid signatures are rejected and logged with correlation data

## ADDED Requirements

### Requirement: Transactional email feedback and suppression
The system MUST persist transactional email delivery feedback, suppress unhealthy recipients according to policy, and expose delivery state for operations.

#### Scenario: Delivery event is recorded from provider feedback
- **WHEN** the email provider reports a delivery, deferral, bounce, or complaint event
- **THEN** the system records a normalized delivery event linked to the affected recipient and outbound message
- **AND** provider metadata is preserved for investigation

#### Scenario: Complaint or hard bounce suppresses future sends
- **WHEN** provider feedback reports a complaint or a suppressing bounce condition for a recipient
- **THEN** the system records suppression state for that normalized email address
- **AND** future transactional sends to that recipient are blocked according to suppression policy

#### Scenario: Internal operator reviews delivery failures
- **WHEN** an internal operator queries delivery-event or suppression state
- **THEN** the system returns persisted delivery feedback and suppression reason context
- **AND** the results are ordered and filterable for investigation
