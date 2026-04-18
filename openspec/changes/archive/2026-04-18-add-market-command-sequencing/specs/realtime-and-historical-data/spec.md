## MODIFIED Requirements

### Requirement: Realtime recovery with sequence checks
The system MUST support snapshot-plus-delta recovery with sequence numbers so clients can detect gaps and resynchronize state.

#### Scenario: Client detects a gap
- **WHEN** a client receives a realtime sequence gap or reconnects after interruption
- **THEN** the system provides a recovery path using current snapshots and subsequent deltas
- **AND** the snapshot includes the latest authoritative sequence baseline for the requested market scope
