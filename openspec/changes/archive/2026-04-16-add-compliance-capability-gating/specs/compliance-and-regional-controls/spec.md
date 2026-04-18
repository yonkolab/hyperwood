## MODIFIED Requirements

### Requirement: Identity and sanctions screening
The system MUST integrate with an identity verification workflow that supports KYC status, sanctions checks, age validation, and provider review references.

#### Scenario: KYC approval enables compliant access
- **WHEN** a user's verification workflow returns an approved result with no active restrictions
- **THEN** the system updates the user's compliance state to approved
- **AND** the system allows capabilities permitted by regional policy

#### Scenario: KYC review blocks trading
- **WHEN** the identity provider or compliance team marks a user as pending review, rejected, or restricted
- **THEN** the system blocks restricted actions such as trading, funding, or withdrawals
- **AND** the system stores the review status and provider reference for auditability

### Requirement: Regional access controls
The system SHALL enforce policy-driven restrictions by country, jurisdiction, legal entity, and funding method.

#### Scenario: Unsupported jurisdiction is denied
- **WHEN** a user from a restricted jurisdiction attempts to access a region-limited capability
- **THEN** the system rejects the action
- **AND** the response identifies that a jurisdiction policy restriction applies

#### Scenario: Funding method availability varies by region
- **WHEN** a user queries available funding methods
- **THEN** the system returns only the methods allowed for that user's compliance profile and region

### Requirement: Risk review hooks
The system MUST support compliance and fraud review signals such as source-of-funds review, suspicious activity flags, and account-level restrictions.

#### Scenario: Compliance hold is applied
- **WHEN** the system or an administrator places an account under compliance review
- **THEN** the system records the restriction set
- **AND** the system prevents actions covered by those restrictions until the review is resolved
