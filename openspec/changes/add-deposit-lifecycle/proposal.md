## Why

Hyperwood can link funding methods and inspect currency-scoped balances, but there is still no executable deposit flow. That leaves the funding domain stuck at configuration instead of actual money movement state.

## What Changes

- Add a persisted deposit transfer record with pending and settled states.
- Add authenticated deposit creation and deposit history reads.
- Add an internal settlement endpoint that finalizes a deposit into the user's cash wallet through the ledger.

## Impact

- Funding becomes a real workflow instead of an admin-only seed mechanism.
- Wallet balances remain correct because pending deposits do not credit cash until settlement.
- Later withdrawal and reconciliation work can build on the same transfer model.
