## 1. Spec Update

- [x] 1.1 Add deltas for order book recovery and sequenced command replay.
- [x] 1.2 Define the HTTP recovery cursor and page semantics.

## 2. Implementation

- [x] 2.1 Add a public market delta endpoint keyed by `afterSequence`.
- [x] 2.2 Return gap-free market sequences with explicit `bookEffect` semantics.
- [x] 2.3 Persist richer immutable command metadata for new order create and cancel events.

## 3. Validation

- [x] 3.1 Run `openspec validate add-order-book-delta-recovery`.
- [x] 3.2 Run `npm run check` and `npm run build`.
