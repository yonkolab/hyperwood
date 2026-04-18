## Context

The platform already serializes market commands and maintains a recoverable order book view, but all orders remain in `queued_for_matching` until manual cancellation. A minimal executable matcher should respect authoritative order acceptance order, update orders in place, and persist trade outputs that later portfolio and settlement slices can consume.

## Decisions

### Decision: Start with explicit internal matching runs

There is no background worker, queue orchestration, or market-specific matching daemon in the current project. This slice therefore introduces an internal route that runs matching for a market on demand while still using the same market advisory lock and sequence model as existing writes.

### Decision: Match only crossable limit orders in this slice

The codebase currently accepts market orders, but market-order lifecycle rules and residual handling are not yet defined well enough to implement them safely. This slice executes only limit-on-limit crosses and leaves market-order execution for a later change.

### Decision: Use order acceptance sequence for time priority

Orders are already serialized into the market command log when created. The matcher reuses the `order_create` sequence as the authoritative time-priority key and sorts by price first, then create sequence, rather than relying on wall-clock timestamps alone.

## Risks and Mitigations

- [Financial state remains provisional after matching] The ledger reservation model is still sized around order acceptance, not fill-by-fill release. Mitigation: keep this slice limited to execution state and trade persistence; portfolio and collateral release logic follow next.
- [Manual invocation could lag behind ingress] Matching is not yet automatic. Mitigation: expose the route as an internal operational command and keep it deterministic so later automation can call the same service.
