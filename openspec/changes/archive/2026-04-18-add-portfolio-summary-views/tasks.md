## 1. Spec Update

- [x] 1.1 Add portfolio summary and fill history deltas.
- [x] 1.2 Define derived resting order value and recent activity semantics.

## 2. Implementation

- [x] 2.1 Add authenticated portfolio summary and fills routes.
- [x] 2.2 Derive positions and recent fills from persisted market trades.
- [x] 2.3 Derive recent ledger activity and resting order value from existing wallet and order records.

## 3. Validation

- [x] 3.1 Run `openspec validate add-portfolio-summary-views`.
- [x] 3.2 Run `npm run check` and `npm run build`.
