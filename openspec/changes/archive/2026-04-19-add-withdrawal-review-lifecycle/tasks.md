## 1. Spec Update

- [x] 1.1 Add withdrawal lifecycle deltas covering hold, review, failure, and settlement.

## 2. Implementation

- [x] 2.1 Add a dedicated withdrawal hold wallet bucket.
- [x] 2.2 Add authenticated withdrawal creation and history routes.
- [x] 2.3 Add internal approval, failure, and settlement transitions backed by the ledger.

## 3. Validation

- [x] 3.1 Run `openspec validate add-withdrawal-review-lifecycle`.
- [x] 3.2 Run `npm run db:generate`, `npm run check`, and `npm run build`.
