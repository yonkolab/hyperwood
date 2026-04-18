## Context

The platform already has ledger-backed wallet balances, accepted orders, and matched trades. Those are enough to derive a first portfolio view without introducing mutable position tables or settlement logic.

## Decisions

### Decision: Keep positions derived at read time

The base portfolio spec explicitly requires positions to be derived from executions and settlement events rather than stored as uncontrolled mutable state. This slice keeps that invariant and calculates open positions directly from trade records.

### Decision: Expose recent fills separately from the summary body

Clients need a compact summary view and a dedicated fills path for pagination or refresh. The summary still includes a small recent fill window, while the fills route gives a larger bounded history read.

### Decision: Report resting order value separately from reserved balance

Current ledger reservations still include both unmatched order collateral and matched-but-unsettled exposure. This slice exposes `restingOrderValueMinor` and `positionCollateralMinor` separately so the UI can distinguish actively resting exposure from already matched exposure without forcing premature ledger redesign.

## Risks and Mitigations

- [Read-time derivation cost grows with fills] Trade history could grow over time. Mitigation: bound recent history endpoints now and keep grouped aggregation logic isolated so it can be materialized later if needed.
- [Sell-side exposure semantics are subtle] The current order model allows naked sells backed by collateral. Mitigation: normalize sell fills into complementary-outcome exposure for this initial portfolio view and document that settlement/offset logic comes later.
