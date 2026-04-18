## Context

The codebase now has user identity, strong access controls, and compliance capability evaluation. Funding still lacks linked methods, wallet accounts, and any ledger-backed balance representation.

## Goals / Non-Goals

**Goals:**
- Persist user-linked funding methods with verification and provider references.
- Add a minimal double-entry ledger foundation for wallet balances.
- Respect compliance capability gating when exposing funding methods and balances.

**Non-Goals:**
- External processor integration.
- Deposit and withdrawal orchestration.
- Trading reservations.

## Decisions

### Decision: Keep linked funding methods separate from transfers

The first slice models funding methods independently from money movement so the registry can exist before deposit and withdrawal orchestration.

Alternatives considered:
- Add transfer orchestration immediately: rejected because it would widen the slice too much.

### Decision: Use wallet accounts plus append-only ledger entries

Wallet balances are derived from ledger entries grouped by wallet account. The first implementation uses a user cash account and a platform clearing account.

Alternatives considered:
- Store mutable balances directly on the user row: rejected because it conflicts with the ledger requirement.

### Decision: Filter visible funding methods through compliance capability evaluation

A user only sees verified methods that are region-eligible and still allowed by the compliance layer.

Alternatives considered:
- Show all linked methods and let later routes fail: rejected because capability evaluation should already shape the visible surface.

## Risks / Trade-offs

- The first ledger model is intentionally small and will need expansion for reservations and transfer states.
- Funding methods filtered in-process still rely on a hardcoded rail-to-country matrix.
- The platform clearing account is a simplification until real external settlement flows exist.
