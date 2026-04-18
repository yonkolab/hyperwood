## Purpose

Define how Hyperwood exposes events and markets for discovery, presents market detail, and manages explicit market lifecycle states.
## Requirements
### Requirement: Event and market discovery
The system SHALL expose event and market discovery with filtering, sorting, keyword search, category grouping, tags, and status-aware listing behavior.

#### Scenario: User filters market catalog
- **WHEN** a client requests markets filtered by category, tag, date, volume, or status
- **THEN** the system returns markets that satisfy those filters
- **AND** the response preserves event and category grouping metadata

#### Scenario: Search returns relevant markets
- **WHEN** a client searches the catalog by keyword
- **THEN** the system returns matching events and markets ordered according to the requested sort rules

### Requirement: Rich market detail metadata
The system MUST expose market detail fields required for informed trading, including pricing, summary data, resolution rules, sources, timelines, and related markets.

#### Scenario: Market detail is requested
- **WHEN** a client fetches a market detail resource
- **THEN** the system returns the current YES and NO prices, resolution criteria, source references, time properties, and status timeline

### Requirement: Explicit market lifecycle states
The system SHALL model markets with explicit lifecycle states including draft, scheduled, active, halted, trading closed, awaiting resolution, settled, cancelled, disputed, and voided.

#### Scenario: Market opens for trading
- **WHEN** an approved scheduled market reaches its opening conditions and exchange state permits trading
- **THEN** the system transitions the market to active
- **AND** the transition is recorded as an auditable state change

#### Scenario: Halted market is not tradable
- **WHEN** a market is in halted, voided, cancelled, or post-close states
- **THEN** the system marks the market as not tradable for new order entry

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

