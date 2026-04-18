## Context

Order acceptance currently moves full order collateral from `user_cash` to `user_order_reserved`. Matching updates fills and trade records, but the ledger does not distinguish unmatched resting reserve from matched-but-unsettled exposure. The system now needs a ledger state that reflects both.

## Decisions

### Decision: Introduce a dedicated user position collateral wallet

Matched exposure is no longer a resting-order reserve, but it is also not spendable cash. A dedicated `user_position_collateral` wallet account type captures that state cleanly and keeps the double-entry ledger append-only.

### Decision: Move only the reserve portion consumed by the fill

Each fill consumes a portion of the order's remaining reserve based on the order's own reserved exposure rule. That consumed reserve is debited from `user_order_reserved`; the actual matched collateral is credited to `user_position_collateral`; any excess caused by price improvement is credited back to `user_cash`.

### Decision: Treat `orders.reservedAmountMinor` as the remaining resting reserve

Once matching can happen incrementally, cancellation and portfolio views need the current remaining reserve amount, not the original accepted reserve. This slice updates `reservedAmountMinor` down as fills occur so later flows can use it directly.

## Risks and Mitigations

- [Historic create events already captured original reserve] Reusing `reservedAmountMinor` as current reserve could blur event history. Mitigation: command metadata for create/cancel already stores immutable event-time amounts, so read models continue to have a stable historical source.
- [Multiple fills on one order] Incremental reserve movement must stay exact across partial fills. Mitigation: compute fill reserve from trade quantity and the order's stored reference price on every execution, then update the order's remaining reserve inside the same transaction.
