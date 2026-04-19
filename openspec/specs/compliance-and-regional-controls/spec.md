## Purpose

Define compliance, KYC, AML, and regional policy behavior that determines whether a Hyperwood user may trade, fund, withdraw, or access restricted capabilities.
## Requirements
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

#### Scenario: Funding method discovery varies by region and currency
- **WHEN** an authenticated user requests eligible funding methods for a currency
- **THEN** the platform evaluates both the user's region policy and the requested currency
- **AND** only rails permitted for that region and currency are returned

### Requirement: Risk review hooks
The system MUST support compliance and fraud review signals such as source-of-funds review, suspicious activity flags, and account-level restrictions.

#### Scenario: Compliance hold is applied
- **WHEN** the system or an administrator places an account under compliance review
- **THEN** the system records the restriction set
- **AND** the system prevents actions covered by those restrictions until the review is resolved

