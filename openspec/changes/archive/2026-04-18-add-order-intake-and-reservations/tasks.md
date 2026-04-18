## 1. Spec Update

- [x] 1.1 Add deltas for executable order intake under trading and funding.
- [x] 1.2 Define the first order acceptance, idempotency, and reservation rules.

## 2. Implementation

- [x] 2.1 Add order persistence and user-scoped idempotency storage.
- [x] 2.2 Extend the ledger model with reserved order wallet accounts and reservation transfers.
- [x] 2.3 Add an authenticated order-create route with compliance, market, and balance validation.

## 3. Validation

- [x] 3.1 Generate the schema migration for order intake and reservation changes.
- [x] 3.2 Run `openspec validate`, `npm run check`, and `npm run build`.
