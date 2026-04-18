## Why

The BRL multi-currency spec is now defined, but the code still assumes USD in market creation, order acceptance, wallet balance reads, and portfolio cash summaries. The first executable step should add market currency metadata and make trading and account reads use it consistently.

## What Changes

- `market-catalog-and-lifecycle`: expose market currency on market creation, listing, and detail reads.
- `trading-and-order-management`: derive order currency from the market instead of a hardcoded default.
- `funding-and-ledger`: let wallet balance reads request a specific currency.
- `portfolio-and-settlement`: let portfolio summary and fills be filtered by currency.

## Impact

- Adds market currency to persistence and APIs.
- Refactors order creation to inherit currency from the target market.
- Refactors wallet and portfolio endpoints to accept a requested currency.
