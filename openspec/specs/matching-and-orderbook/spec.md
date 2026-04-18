## Purpose

Define the deterministic matching and order book behavior that underpins Hyperwood's binary market execution model.
## Requirements
### Requirement: Deterministic order sequencing
The matching engine MUST process conflicting order intents for a market in a deterministic sequence that can be replayed for audit and recovery.

#### Scenario: Same-market writes are serialized
- **WHEN** multiple order commands target the same market concurrently
- **THEN** the system processes them through a single-writer or equivalent deterministic sequencing mechanism
- **AND** the resulting sequence numbers define the authoritative execution order

#### Scenario: Market command is persisted with sequence
- **WHEN** an order create or cancellation command succeeds for a market
- **THEN** the system records a command event with that market's next authoritative sequence number
- **AND** later snapshot or replay flows can use that sequence as the recovery baseline

### Requirement: Price-time priority matching
The matching engine SHALL maintain a central limit order book and match resting and incoming orders according to price-time priority.

#### Scenario: Best-priced order matches first
- **WHEN** an incoming order can trade against multiple resting orders on the opposite side
- **THEN** the system matches the best-priced eligible liquidity first
- **AND** time priority breaks ties within the same price level

#### Scenario: Partial fill leaves residual quantity
- **WHEN** an order is only partially satisfied by available liquidity
- **THEN** the system emits trade and fill events for the executed quantity
- **AND** the remaining quantity keeps the correct resting or terminal state

#### Scenario: Internal match run executes crossable limit liquidity
- **WHEN** an internal matching run is triggered for a market
- **THEN** the system evaluates queued and partially-filled limit orders in authoritative price-time order
- **AND** it records durable trade outputs plus updated order states for each resulting fill

### Requirement: Order book views
The system MUST expose best bid and ask, full depth by price level, periodic snapshots, and incremental updates suitable for realtime consumers.

#### Scenario: Snapshot and deltas stay aligned
- **WHEN** a client fetches an order book snapshot and then consumes incremental updates
- **THEN** the updates are sequenced so the client can detect gaps and maintain a consistent local book view
- **AND** the snapshot exposes the latest authoritative market sequence at the time of the read

#### Scenario: Snapshot recovery uses sequenced delta pages
- **WHEN** a client needs order book changes after a known market sequence
- **THEN** the system provides a delta page ordered by ascending market sequence
- **AND** every intervening market command appears exactly once in that page window
- **AND** each delta declares whether it mutates visible resting depth or only advances the sequence cursor

### Requirement: Public order book snapshot API
The system SHALL expose a public order book snapshot for each market using current resting limit orders grouped into price-level depth.

#### Scenario: Market order book snapshot is requested
- **WHEN** a client requests the order book snapshot for a market
- **THEN** the system returns grouped YES and NO bid and ask depth, best bid and ask values, and snapshot metadata

#### Scenario: Unknown market order book is requested
- **WHEN** a client requests the order book snapshot for a market that does not exist
- **THEN** the system rejects the request with a not-found error

