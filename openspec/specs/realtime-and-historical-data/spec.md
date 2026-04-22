## Purpose

Define how Hyperwood distributes live market and account updates and how it separates, retains, and exports historical data.
## Requirements
### Requirement: Public and private realtime channels
The system SHALL provide streaming channels for public market data and authenticated private account updates.

#### Scenario: Public market stream subscription
- **WHEN** a client subscribes to a public market channel
- **THEN** the system streams market summary, trade, order book, and status-change updates for the subscribed market scope

#### Scenario: Private account stream subscription
- **WHEN** an authenticated client subscribes to a private user stream
- **THEN** the system streams order, fill, balance, transfer, and settlement updates authorized for that user

### Requirement: Public market SSE stream
The system SHALL provide a public streaming channel for one market scope using a documented realtime transport and recovery contract.

#### Scenario: Client subscribes to a market SSE stream
- **WHEN** a client connects to the public market stream for an existing market
- **THEN** the system returns an initial snapshot containing market summary, current order book state, and recent trades
- **AND** the stream remains open for subsequent public market events

#### Scenario: Market stream emits public updates
- **WHEN** market activity changes public state for the subscribed market
- **THEN** the stream emits typed events for order book changes, trades, status changes, or announcements
- **AND** the event payload contains the market identifier and enough state to update the client view without ambiguity

### Requirement: Authenticated account SSE stream
The system SHALL provide an authenticated SSE stream for one user and currency scope.

#### Scenario: Client subscribes to an authenticated account stream
- **WHEN** an authenticated client connects to the private account stream for a supported currency
- **THEN** the system returns an initial account snapshot containing portfolio summary, recent fills, and recent settlements for that user and currency
- **AND** the stream remains open for subsequent account events

#### Scenario: Account stream emits private user updates
- **WHEN** an authenticated user's orders, balances, transfers, fills, or settlements change
- **THEN** the account stream emits typed events scoped to that user and currency
- **AND** no other user's account updates are exposed through that stream

### Requirement: Realtime recovery with sequence checks
The system MUST support snapshot-plus-delta recovery with sequence numbers so clients can detect gaps and resynchronize state.

#### Scenario: Client detects a gap
- **WHEN** a client receives a realtime sequence gap or reconnects after interruption
- **THEN** the system provides a recovery path using current snapshots and subsequent deltas
- **AND** the snapshot includes the latest authoritative sequence baseline for the requested market scope

#### Scenario: Client replays deltas after a snapshot
- **WHEN** a client requests market deltas after a known snapshot sequence
- **THEN** the recovery response includes the latest known market sequence, a bounded delta page, and a cursor for additional replay if more data remains
- **AND** the client can advance to the next cursor without ambiguity or silent sequence skips

### Requirement: Separate historical access paths
The system SHALL expose historical data through dedicated historical access paths for archived markets, orders, fills, trades, charts, and account exports.

#### Scenario: Historical market trades are served through a dedicated path
- **WHEN** a client requests trades for an archived market such as a settled, voided, or cancelled market
- **THEN** the live market trades path rejects the request in favor of a historical path
- **AND** the dedicated historical trades path returns the archived trades for that market

#### Scenario: User requests historical account orders
- **WHEN** an authenticated user requests the historical account orders path for a supported currency
- **THEN** the system returns the user's order history ordered from newest to oldest
- **AND** each record includes market and order state details needed for historical review

#### Scenario: User requests historical account fills
- **WHEN** an authenticated user requests the historical account fills path for a supported currency
- **THEN** the system returns the user's fill history through a dedicated historical route
- **AND** no other user's account history is exposed

#### Scenario: Archived market candles are served through a historical path
- **WHEN** a client requests candles for an archived market
- **THEN** the system returns bucketed OHLCV candles derived from archived trades
- **AND** the response identifies the requested interval and archived market scope

### Requirement: Historical exports and retention
The system MUST support archival policies, historical exports, and retained order book or candlestick data suitable for compliance and analytics use cases.

#### Scenario: User requests historical export
- **WHEN** an eligible user or admin requests an account or market history export
- **THEN** the system generates an export job and makes the resulting artifact available through an approved delivery path

#### Scenario: User requests account history export
- **WHEN** an authenticated user requests an account history export for a supported currency
- **THEN** the system creates an export job and completes it with a persisted artifact
- **AND** the user can retrieve the resulting artifact through an authenticated historical export path
