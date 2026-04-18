## Context

Current implementation hardcodes `USD` in order creation, order schema defaults, wallet balance reads, and portfolio cash summaries. That is already too narrow for a Brazil-facing product where users will expect BRL balances, BRL-denominated markets, and `pix` as a native BRL rail.

## Decisions

### Decision: Model currency at the market level

Orders, reservations, fills, and settlement should not choose currency independently. Each market must declare a quote and settlement currency, and every trading flow in that market must inherit it.

### Decision: Keep ledgers and positions segregated by currency

Wallet balances, reserved collateral, position collateral, and portfolio summaries must remain grouped by currency. The system should not synthesize a cross-currency total unless a separate FX policy exists.

### Decision: Make regional rails currency-constrained

Funding rails are not merely transport methods. `pix` is BRL-native, ACH is USD-native, and any cross-currency movement must be explicit rather than implied by a generic funding method registry.

### Decision: Forbid cross-currency order execution

Orders should only match within a market's declared currency. There is no FX engine, no conversion ledger, and no quote normalization layer in the current product boundary.

## Risks and Mitigations

- [USD assumptions are already spread across code] The spec must clearly identify each affected domain so the later refactor does not become piecemeal.
- [Portfolio totals become ambiguous] Avoid a single `totalBalanceMinor` across currencies unless it is explicitly currency-scoped or backed by an FX policy.
- [Brazil rollout can create rail-policy edge cases] Encode `pix` and Brazil regional constraints explicitly in compliance and funding specs rather than leaving them implicit.
