## Context

The current system supports order create, cancel, and public book snapshots, but command ordering is implicit in database timestamps and transaction commit timing. The matching spec requires same-market writes to be serialized with authoritative sequence numbers, and the realtime spec requires snapshot-plus-delta recovery with sequence checks.

## Goals / Non-Goals

**Goals:**

- Serialize order create and cancel commands per market.
- Persist authoritative command sequence numbers in a replayable log.
- Surface the current market sequence in order write responses and order book snapshots.

**Non-Goals:**

- Execute matching or fills.
- Stream deltas to clients.
- Introduce a distributed job queue or separate matching service.

## Decisions

### Decision: Use Postgres advisory transaction locks per market

Current writes already run inside Postgres transactions, so advisory transaction locks provide a practical single-writer mechanism for same-market commands without introducing external infrastructure.

Alternatives considered:

- In-process mutexes: rejected because they would not protect multi-process deployments.
- Dedicated command queue service: rejected because it is too large for the current slice.

### Decision: Track the latest market sequence on the `markets` row

Each serialized command increments `markets.lastCommandSequence`, and the resulting value becomes the authoritative sequence for the new command log entry. This keeps snapshot reads simple and avoids computing sequences from aggregate logs on every request.

Alternatives considered:

- Compute `max(sequence) + 1` from the log table: rejected because the counter belongs to the market aggregate and would be more expensive to read and maintain.

### Decision: Persist a `market_command_events` log

A dedicated log records the command type, order, market, sequence, and metadata so later matching and realtime work can replay or inspect market writes directly.

Alternatives considered:

- Store only the sequence on the order row: rejected because cancellations and future amendments are commands, not new orders.

## Risks / Trade-offs

- [Serialization is only per market, not global] -> This matches the spec requirement and preserves throughput across independent markets.
- [Advisory locks depend on consistent keying] -> Derive the lock key from the market identifier inside the database to avoid application-side collisions.
- [Snapshot sequence is still a baseline, not deltas] -> Follow with realtime delta streams that consume the same sequence source.

## Migration Plan

1. Add the market sequence counter and command log table.
2. Update order create and cancel flows to use per-market serialized sequencing.
3. Expose the resulting sequence in order book snapshots and write responses.
4. Follow with delta streaming or matching logic that consumes the same command sequence.

Rollback strategy:

- Revert the application changes and roll back the new sequence state and command log schema before downstream consumers depend on it.

## Open Questions

- Whether future fills and settlement commands should share the same market command stream or use adjacent event logs.
- Whether account-private streams should expose raw market command sequences or only order/fill sequences scoped to the user.
