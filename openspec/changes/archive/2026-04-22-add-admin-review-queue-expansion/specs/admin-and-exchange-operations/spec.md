## ADDED Requirements
### Requirement: KYC and flagged-account review sources appear in the admin queue
The system MUST expose non-approved KYC cases and unresolved account restrictions through the internal operations review queue.

#### Scenario: Pending or non-approved KYC case appears in the review queue
- **WHEN** an internal operator queries the review queue
- **AND** a user has a compliance profile whose KYC status is not approved or whose sanctions status is not clear
- **THEN** the response includes a KYC review item with user and profile context

#### Scenario: Unresolved account restriction appears in the review queue
- **WHEN** an internal operator queries the review queue
- **AND** a user has an unresolved account restriction
- **THEN** the response includes a flagged-account review item with restriction scope, source, reason, and user context
