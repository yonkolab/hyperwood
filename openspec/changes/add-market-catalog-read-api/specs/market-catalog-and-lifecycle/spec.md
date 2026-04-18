## ADDED Requirements

### Requirement: Public market catalog read API
The system SHALL expose a public market catalog API with executable filtering, search, sorting, and event grouping metadata for markets that have been published into the catalog.

#### Scenario: User filters market catalog
- **WHEN** a client requests the market catalog with category, status, tag, or keyword filters
- **THEN** the system returns only markets that satisfy the supplied filters
- **AND** the response includes event and category grouping metadata for the returned markets

#### Scenario: User requests sorted market catalog
- **WHEN** a client requests the market catalog with a supported sort order
- **THEN** the system orders the returned markets according to that sort
- **AND** the response preserves the active filter metadata

### Requirement: Public market detail API
The system MUST expose a market detail resource that returns the current lifecycle state, pricing snapshot, resolution references, and timeline fields required for informed trading review.

#### Scenario: Market detail is requested
- **WHEN** a client fetches a published market detail resource by identifier
- **THEN** the system returns the market with its parent event metadata, current YES and NO prices, lifecycle status, timeline fields, and resolution references

#### Scenario: Unknown market detail is requested
- **WHEN** a client fetches a market detail resource that does not exist
- **THEN** the system rejects the request with a not-found error
