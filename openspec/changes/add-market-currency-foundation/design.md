## Context

The new BRL support spec defines the end-state, but the current codebase still hardcodes USD in multiple request flows. A smaller implementation slice is needed so currency becomes explicit before broader rail and settlement changes land.

## Decisions

### Decision: Add explicit market currency first

Orders, fills, and collateral should inherit currency from the market. That requires market currency to exist in persistence and API reads before any later multi-currency refactor can be trusted.

### Decision: Keep account reads currency-filtered in this slice

Portfolio and wallet APIs should accept a requested currency and return only that scope for now. Grouped multi-currency aggregate responses can follow once more currencies and balances exist in production data.

### Decision: Restrict supported market currencies to USD and BRL for now

The platform has an immediate Brazil use case and an existing USD baseline. Encoding those two currencies now keeps validation explicit while avoiding a premature generic FX design.
