## 1. Spec Update

- [x] 1.1 Add deltas for market command sequencing and recovery baselines.
- [x] 1.2 Define the first command log and snapshot sequence expectations.

## 2. Implementation

- [x] 2.1 Add market sequence state and a persistent market command log.
- [x] 2.2 Serialize order create and cancel commands per market and persist sequence numbers.
- [x] 2.3 Expose market sequence metadata in write responses and order book snapshots.

## 3. Validation

- [x] 3.1 Generate the schema migration for command sequencing.
- [x] 3.2 Run `openspec validate`, `npm run check`, and `npm run build`.
