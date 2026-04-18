## 1. Spec Update

- [x] 1.1 Add deltas for bounded price-time matching.
- [x] 1.2 Define the first executable trade and partial-fill behavior.

## 2. Implementation

- [x] 2.1 Add order fill state and persisted market trades.
- [x] 2.2 Implement an internal market matching run for crossable limit orders.
- [x] 2.3 Expose recent market trades and update order-book reads to use remaining quantity.

## 3. Validation

- [x] 3.1 Run `openspec validate add-limit-order-matching`.
- [x] 3.2 Run `npm run db:generate`, `npm run check`, and `npm run build`.
