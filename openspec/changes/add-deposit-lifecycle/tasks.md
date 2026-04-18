## 1. Spec Update

- [x] 1.1 Add deposit lifecycle deltas to funding and ledger requirements.

## 2. Implementation

- [x] 2.1 Add persisted funding transfer storage for deposits.
- [x] 2.2 Add authenticated deposit creation and history read routes.
- [x] 2.3 Add internal deposit settlement that credits the user's wallet through the ledger.

## 3. Validation

- [x] 3.1 Run `openspec validate add-deposit-lifecycle`.
- [x] 3.2 Run `npm run db:generate`, `npm run check`, and `npm run build`.
