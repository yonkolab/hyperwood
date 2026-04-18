## 1. Spec Update

- [x] 1.1 Add deltas for order cancellation and reservation release.
- [x] 1.2 Define the first cancellation eligibility and retry rules.

## 2. Implementation

- [x] 2.1 Extend order persistence with explicit cancellation state metadata.
- [x] 2.2 Add ledger-backed release of reserved collateral on cancellation.
- [x] 2.3 Add an authenticated order-cancel route for the owning user.

## 3. Validation

- [x] 3.1 Generate the schema migration for cancellation support.
- [x] 3.2 Run `openspec validate`, `npm run check`, and `npm run build`.
