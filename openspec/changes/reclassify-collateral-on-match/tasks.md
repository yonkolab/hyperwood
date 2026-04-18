## 1. Spec Update

- [x] 1.1 Add deltas for matched collateral reclassification.
- [x] 1.2 Define partially-filled order cancellation against remaining reserve.

## 2. Implementation

- [x] 2.1 Add a dedicated position collateral wallet account type.
- [x] 2.2 Reclassify collateral and release price improvement during matching.
- [x] 2.3 Allow cancellation of partially-filled orders using remaining reserve balances.
- [x] 2.4 Expose position collateral in wallet and portfolio responses.

## 3. Validation

- [x] 3.1 Run `openspec validate reclassify-collateral-on-match`.
- [x] 3.2 Run `npm run db:generate`, `npm run check`, and `npm run build`.
