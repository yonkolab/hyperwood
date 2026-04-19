## ADDED Requirements

### Requirement: Administrative market resolution actions

The system SHALL provide internal workflows for approving market outcomes and executing settlement.

#### Scenario: Admin resolves a market

- **WHEN** an authorized operator submits an approved market outcome
- **THEN** the system records the actor metadata and evidence context
- **AND** updates the market into its pre-settlement resolved state

#### Scenario: Admin settles a resolved market

- **WHEN** an authorized operator executes settlement for a resolved market
- **THEN** the system applies the settlement exactly once
- **AND** returns a summary of payouts and affected users
