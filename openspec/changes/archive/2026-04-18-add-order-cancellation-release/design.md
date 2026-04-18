## Context

The current order-ingress slice creates `queued_for_matching` orders and reserves collateral immediately, but there is no lifecycle exit other than future fills. The trading spec requires user-visible cancellation behavior, and the funding spec requires released reservation effects to be recorded as compensating ledger entries rather than destructive mutation.

## Goals / Non-Goals

**Goals:**

- Allow the owning user to cancel an order that is still resting.
- Change the order state to `cancelled` in a transactional way with the reservation release.
- Make repeated cancellation requests stable without creating duplicate ledger releases.

**Non-Goals:**

- Partial cancellation or decrease flows.
- Cancellation rules for already matched or partially filled orders.
- Matching-engine coordination or exchange-level halt logic.

## Decisions

### Decision: Only cancel `queued_for_matching` orders in this slice

That is the only executable resting state the system currently creates. Restricting cancellation to that state keeps behavior precise and prevents premature assumptions about partial fills.

Alternatives considered:

- Allow cancellation for every non-filled state now: rejected because later matching semantics may require finer-grained release rules.

### Decision: Make repeated DELETE calls idempotent by returning the already-cancelled order

If the same user retries cancellation after a successful cancel, the service returns the current cancelled order without posting another ledger transaction. This keeps client retries safe without adding extra idempotency headers for DELETE.

Alternatives considered:

- Return a conflict for already cancelled orders: rejected because it makes retry behavior worse and adds no safety.

### Decision: Release collateral with a separate `order_release` ledger transaction

Cancellation posts a new transaction that debits the reserved wallet and credits the available wallet. This preserves the append-only guarantee and creates a clean audit trail of reservation lifecycle events.

Alternatives considered:

- Delete or update the original reservation entries: rejected because it breaks ledger immutability.

## Risks / Trade-offs

- [Only full cancellation is supported] -> Follow with decrease/amendment as a separate trading slice.
- [Cancellation assumes no fills occurred] -> Restrict cancellation eligibility to `queued_for_matching` orders only.
- [Reservation release depends on the stored collateral amount] -> Release exactly the recorded `reservedAmountMinor` instead of recalculating from mutable market data.

## Migration Plan

1. Add an explicit cancellation timestamp to the order schema.
2. Register the authenticated cancellation route.
3. Generate the migration and validate the change.
4. Follow with decrease/amendment and matching slices that introduce more complex release semantics.

Rollback strategy:

- Revert the application changes and roll back the order-table alteration before dependent lifecycle work ships.

## Open Questions

- Whether future cancellation should support exchange-initiated admin actions separately from user-initiated cancellations.
- Whether the order API should expose a dedicated order-read route before amendment and fill history are introduced.
