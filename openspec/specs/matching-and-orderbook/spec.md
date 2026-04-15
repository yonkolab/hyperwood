## Purpose

Define the deterministic matching and order book behavior that underpins Hyperwood's binary market execution model.

## Requirements

### Requirement: Deterministic order sequencing
The matching engine MUST process conflicting order intents for a market in a deterministic sequence that can be replayed for audit and recovery.

#### Scenario: Same-market writes are serialized
- **WHEN** multiple order commands target the same market concurrently
- **THEN** the system processes them through a single-writer or equivalent deterministic sequencing mechanism
- **AND** the resulting sequence numbers define the authoritative execution order

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

### Requirement: Order book views
The system MUST expose best bid and ask, full depth by price level, periodic snapshots, and incremental updates suitable for realtime consumers.

#### Scenario: Snapshot and deltas stay aligned
- **WHEN** a client fetches an order book snapshot and then consumes incremental updates
- **THEN** the updates are sequenced so the client can detect gaps and maintain a consistent local book view
