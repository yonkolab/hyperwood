## ADDED Requirements

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
