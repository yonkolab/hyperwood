## Why

The platform now supports BRL- and USD-scoped balances, markets, and orders, but funding method discovery is still currency-blind. That leaves a gap where `pix` can appear alongside USD flows and region-specific rails are not filtered by the requested funding currency.

## What Changes

- Add currency-aware funding method discovery for authenticated users.
- Enforce region and rail compatibility when registering funding methods.
- Expose supported currencies for each returned funding method so clients can render constrained rails correctly.

## Impact

- Funding discovery aligns with the BRL multi-currency rules already defined in OpenSpec.
- Brazil users can request BRL-compatible methods and receive `pix` only for BRL flows.
- Invalid rail-country combinations are rejected before they enter the registry.
