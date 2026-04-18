## 1. Spec Update

- [x] 1.1 Add BRL and multi-currency deltas across markets, trading, funding, portfolio, and compliance.
- [x] 1.2 Define market currency inheritance, currency-aware portfolio semantics, and rail compatibility rules.

## 2. Implementation Planning

- [ ] 2.1 Refactor market schema and APIs to expose market currency.
- [ ] 2.2 Refactor order, ledger, and matching flows to inherit currency from the market.
- [ ] 2.3 Refactor wallet and portfolio APIs to return currency-scoped balances instead of a single implicit USD view.

## 3. Validation

- [x] 3.1 Run `openspec validate add-brl-multi-currency-support`.
