## ADDED Requirements

### Requirement: Public and private realtime channels
The system SHALL provide streaming channels for public market data and authenticated private account updates.

#### Scenario: Public market stream subscription
- **WHEN** a client subscribes to a public market channel
- **THEN** the system streams market summary, trade, order book, and status-change updates for the subscribed market scope

#### Scenario: Private account stream subscription
- **WHEN** an authenticated client subscribes to a private user stream
- **THEN** the system streams order, fill, balance, transfer, and settlement updates authorized for that user

### Requirement: Realtime recovery with sequence checks
The system MUST support snapshot-plus-delta recovery with sequence numbers so clients can detect gaps and resynchronize state.

#### Scenario: Client detects a gap
- **WHEN** a client receives a realtime sequence gap or reconnects after interruption
- **THEN** the system provides a recovery path using current snapshots and subsequent deltas

### Requirement: Separate historical access paths
The system SHALL expose historical data through dedicated historical access paths for archived markets, orders, fills, trades, charts, and account exports.

#### Scenario: Historical query crosses archival boundary
- **WHEN** a client requests data that has moved beyond the live retention boundary
- **THEN** the system serves that data through the historical path instead of the live operational path

### Requirement: Historical exports and retention
The system MUST support archival policies, historical exports, and retained order book or candlestick data suitable for compliance and analytics use cases.

#### Scenario: User requests historical export
- **WHEN** an eligible user or admin requests an account or market history export
- **THEN** the system generates an export job and makes the resulting artifact available through an approved delivery path
