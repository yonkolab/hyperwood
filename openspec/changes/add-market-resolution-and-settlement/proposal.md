## Why

Hyperwood can create markets, accept orders, match trades, and derive positions, but there is still no executable path to resolve a market and convert matched collateral into final cash balances.

## What Changes

- Add an internal market resolution workflow with explicit approved outcome metadata.
- Add settlement execution that consumes position collateral and credits final payouts through the ledger.
- Expose settlement results in market detail and authenticated portfolio history.
- Add OpenAPI documentation and automated tests for the new endpoints and settlement behavior.

## Impact

- Markets can advance from trading to an authoritative resolved and settled state.
- Portfolio and balance views can reflect completed settlement events instead of only open collateral.
- The settlement portion of the portfolio-and-settlement spec becomes executable.
