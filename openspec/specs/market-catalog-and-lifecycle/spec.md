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
- **AND** the market response includes the market's quote and settlement currency

### Requirement: Explicit market lifecycle states
The system SHALL model markets with explicit lifecycle states including draft, scheduled, active, halted, trading closed, awaiting resolution, settled, cancelled, disputed, and voided.

#### Scenario: Admin applies a lifecycle transition
- **WHEN** an authorized internal workflow changes a market from one lifecycle state to another allowed state
- **THEN** the system updates the market status
- **AND** it records the from-state, to-state, reason, and actor in durable transition history

#### Scenario: Disputed market blocks settlement
- **WHEN** a market is marked as disputed before final settlement execution
- **THEN** the system rejects settlement attempts until the market leaves the disputed state

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

### Requirement: Market detail includes resolution and settlement state

The system MUST expose market-level resolution and settlement metadata in market detail responses once those events exist.

#### Scenario: Consumer requests a resolved market

- **WHEN** a client requests market detail for a market that has been resolved or settled
- **THEN** the system returns the recorded resolution outcome, evidence summary, and settlement timestamp alongside the existing market lifecycle fields

