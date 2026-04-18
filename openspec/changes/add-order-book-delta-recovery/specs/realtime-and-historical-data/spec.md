## MODIFIED Requirements

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
