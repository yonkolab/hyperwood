## Context

The current platform already has:

- market lifecycle state on `markets`
- authoritative matched trades in `market_trades`
- position collateral tracked in `user_position_collateral`
- portfolio derivation based on normalized fill exposure

What is missing is the closing workflow that records an approved outcome and transforms pooled collateral into final cash balances.

## Decisions

### Decision: Add explicit resolution and settlement records

Resolution and settlement are operationally important events. They should be queryable and auditable instead of being inferred from one-off ledger metadata.

### Decision: Reuse the normalized exposure model already used by portfolio views

For settlement, a `buy yes` position wins on `yes`, and a `sell yes` position normalizes to `no`. Reusing the same normalized exposure rule avoids divergent position semantics between portfolio reads and settlement execution.

### Decision: Settle from position collateral into user cash through the ledger

Matching already reclassifies filled reserve into `user_position_collateral`. Settlement should debit that collateral bucket and credit user cash based on the resolved outcome.

### Decision: Expose settlement to both market and portfolio consumers

Market detail should show resolution and settlement metadata for public consumers, while authenticated users should have a settlement history view under portfolio endpoints.

## Risks and Mitigations

- [Settlement runs twice] Enforce one settlement record per market and return idempotent responses when already settled.
- [Open orders remain on a market being settled] Block resolution or settlement while open orders still rest on the book.
- [Position semantics drift from portfolio reads] Use the same normalized outcome rules already present in the portfolio service.
