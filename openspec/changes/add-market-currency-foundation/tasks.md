## 1. Spec Update

- [x] 1.1 Add deltas for market currency metadata and currency-filtered account reads.
- [x] 1.2 Define order currency inheritance from the market.

## 2. Implementation

- [x] 2.1 Add market currency persistence and expose it in market APIs.
- [x] 2.2 Derive order currency from the market instead of a hardcoded USD constant.
- [x] 2.3 Add `currency` query support to wallet and portfolio reads.

## 3. Validation

- [x] 3.1 Run `openspec validate add-market-currency-foundation`.
- [x] 3.2 Run `npm run db:generate`, `npm run check`, and `npm run build`.
