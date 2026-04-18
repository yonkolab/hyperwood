## Why

Hyperwood can accept, cancel, and expose resting orders, but those same-market writes still have no authoritative sequence. The next useful matching slice is to serialize market command writes and expose replayable sequence numbers that future deltas and matching logic can build on.

## What Changes

- Add deterministic per-market sequencing for order create and cancel commands.
- Persist a market command log with authoritative sequence numbers.
- Expose the current market sequence in order write responses and order book snapshots for recovery baselines.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `matching-and-orderbook`: add executable same-market write sequencing and sequence-backed snapshot metadata.
- `realtime-and-historical-data`: provide current snapshot sequence metadata as the first recovery baseline for future deltas.

## Impact

- Adds OpenSpec deltas under `openspec/changes/add-market-command-sequencing/specs/`.
- Extends market and order persistence with sequence state and command event storage.
- Updates order and order-book responses to surface authoritative market sequence data.
