## MODIFIED Requirements

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
