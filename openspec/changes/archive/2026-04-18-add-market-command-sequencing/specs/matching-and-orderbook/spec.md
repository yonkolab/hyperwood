## MODIFIED Requirements

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

### Requirement: Order book views
The system MUST expose best bid and ask, full depth by price level, periodic snapshots, and incremental updates suitable for realtime consumers.

#### Scenario: Snapshot and deltas stay aligned
- **WHEN** a client fetches an order book snapshot and then consumes incremental updates
- **THEN** the updates are sequenced so the client can detect gaps and maintain a consistent local book view
- **AND** the snapshot exposes the latest authoritative market sequence at the time of the read
