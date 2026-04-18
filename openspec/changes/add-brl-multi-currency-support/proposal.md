## Why

Hyperwood currently assumes `USD` across order entry, wallet balances, and portfolio reads, but the product is intended for Brazil and already exposes region-specific rails like `pix`. Currency behavior is a product rule, not an implementation detail, so it needs an explicit spec before the codebase grows further around USD-only assumptions.

## What Changes

- `market-catalog-and-lifecycle`: define market quote/settlement currency as first-class market metadata.
- `trading-and-order-management`: require orders to inherit the market currency and prohibit cross-currency matching.
- `funding-and-ledger`: define wallet, reservation, and ledger behavior across multiple currencies, including BRL.
- `portfolio-and-settlement`: require currency-aware balances and position reporting.
- `compliance-and-regional-controls`: define Brazil-oriented rail and region compatibility rules, especially for `pix`.

## Impact

- Adds OpenSpec deltas for BRL and multi-currency behavior without changing implementation yet.
- Creates the contract needed to refactor current USD-only order, wallet, and portfolio flows safely.
