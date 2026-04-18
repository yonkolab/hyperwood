## Context

The current codebase can register users, evaluate compliance capabilities, seed wallet balances, and expose market catalog data, but it has no trading write path. The next executable slice should let eligible users submit orders without forcing matching, settlement, or position accounting into the same change.

## Goals / Non-Goals

**Goals:**

- Accept authenticated order intents for active binary markets.
- Enforce compliance, market, quantity, and available-balance validation before an order is stored.
- Make order creation idempotent and ensure reservation side effects are not duplicated.
- Reserve maximum-loss collateral through the append-only ledger on successful order acceptance.

**Non-Goals:**

- Matching engine sequencing, fills, or order book maintenance.
- Order cancellation, amendment, or reservation release workflows.
- Position derivation, settlement, or portfolio summary APIs.

## Decisions

### Decision: Treat this slice as order ingress, not execution

Accepted orders are recorded in a queued-for-matching state and reserve collateral immediately, but they are not matched in this change. This keeps the slice independently useful while preserving a clean boundary before deterministic sequencing work.

Alternatives considered:

- Build matching and order ingress together: rejected because it couples two large specs and slows delivery.

### Decision: Use the order row itself as the idempotency record

Each order stores the user-scoped idempotency key and a request hash. If the same key is reused with the same payload, the service returns the original order. If the payload changes, the service rejects the request. This avoids a separate idempotency table for the initial slice.

Alternatives considered:

- Dedicated idempotency table: rejected because it adds another write path without extra value for a single order-create endpoint.

### Decision: Reserve max-loss cash in a dedicated reserved wallet account

Order acceptance moves collateral from `user_cash` to a `user_order_reserved` wallet account using a double-entry ledger transaction. This makes available cash decrease immediately while preserving a clean audit trail and a future path to release or settlement flows.

Alternatives considered:

- Store reserved amounts directly on the order row: rejected because it breaks the ledger-as-source-of-truth model.
- Keep reservations off-ledger until matching exists: rejected because the funding spec already requires ledger-backed reservation state.

### Decision: Support buy and sell on binary outcomes through max-loss collateral

For binary contracts, buy-side collateral is the selected outcome price and sell-side collateral is the complementary loss amount. This lets the API accept both buy and sell sides now without needing positions or borrow logic first.

Alternatives considered:

- Restrict to buy-only orders: rejected because it diverges from the trading capability baseline.

## Risks / Trade-offs

- [Accepted orders are not yet executable against counterparties] -> Store them in an explicit queued-for-matching state and keep the scope aligned with the next matching change.
- [Collateral is rounded up to cents from basis-point pricing] -> Round upward conservatively so reservations never under-collateralize the order.
- [Wallet balance semantics change once reservations exist] -> Return reserved and total fields alongside available balance in the funding response.

## Migration Plan

1. Add order tables and the reserved wallet account type.
2. Register the authenticated order route.
3. Generate the migration and validate the new change.
4. Follow with matching-engine and cancellation changes that consume the queued order records and reserved balances.

Rollback strategy:

- Revert the application change and roll back the order tables and wallet-account enum additions before dependent changes ship.

## Open Questions

- Whether order create should eventually use a request header or a body field as the canonical idempotency key for all private write APIs.
- Whether price increments should remain arbitrary basis points or be tightened to a coarser grid once matching is introduced.
