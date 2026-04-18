## Context

The system now creates `queued_for_matching` limit orders and can cancel them, but there is no public view of current depth. The matching baseline spec is broader than what the codebase can support today, so the next slice should expose a deterministic snapshot from existing order data without introducing an execution engine or realtime transport.

## Goals / Non-Goals

**Goals:**

- Expose a public order book snapshot for a market using current resting limit orders.
- Return best bid/ask and grouped depth by price level for YES and NO books.
- Include lightweight snapshot sequencing metadata suitable for later snapshot-plus-delta recovery.

**Non-Goals:**

- Matching incoming orders.
- Streaming incremental updates.
- Crossed-book prevention or exchange-level sequencing beyond current stored order state.

## Decisions

### Decision: Build snapshots from resting limit orders only

Only `queued_for_matching` limit orders represent bookable liquidity in the current system. Market orders are excluded because they do not create resting depth.

Alternatives considered:

- Include all queued orders: rejected because market orders do not have valid book price levels.

### Decision: Group depth by outcome, side, and limit price

The current schema stores outcome and side directly, so the snapshot groups on those dimensions and computes total resting quantity plus order counts per price level. This is sufficient for public depth and best-price views without introducing a separate book table.

Alternatives considered:

- Materialized order book table: rejected because there is no matching engine yet to maintain it reliably.

### Decision: Use a snapshot token derived from the latest contributing order timestamp and count

The first slice only needs a stable baseline marker, not a fully replayable event sequence. Returning a snapshot token built from the current book state provides a practical bridge to future delta streams.

Alternatives considered:

- Add per-market write sequence columns now: rejected because that is better introduced together with deterministic sequencing and matching.

## Risks / Trade-offs

- [No incremental deltas yet] -> Return snapshot metadata explicitly and follow with realtime deltas as a separate slice.
- [Crossed books can appear because matching is not implemented] -> Expose raw resting depth truthfully and leave crossed-book prevention to the matching slice.
- [Snapshot token is not yet a full event sequence] -> Treat it as a recovery baseline only until deterministic write sequencing is added.

## Migration Plan

1. Add the snapshot route to the market-facing API.
2. Validate the OpenSpec change and application code.
3. Follow with deterministic market sequencing and delta streams.

Rollback strategy:

- Revert the route and snapshot query logic. No schema rollback is required for this slice.

## Open Questions

- Whether future order book consumers should read by market UUID only or also by slug.
- Whether the final realtime design should use websocket channels, SSE, or both for order book deltas.
