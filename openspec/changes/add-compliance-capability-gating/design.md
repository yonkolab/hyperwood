## Context

The current codebase has identity, sessions, MFA, and API key controls, but no executable compliance layer. `users` currently carries only a coarse `kycStatus` and no auditable review references or capability evaluation.

## Goals / Non-Goals

**Goals:**
- Persist the minimum compliance state required to gate user capabilities.
- Represent account-level holds and restrictions explicitly.
- Give authenticated users a direct way to inspect capability access outcomes.

**Non-Goals:**
- Live integration with an external KYC vendor.
- Full AML case management.
- Admin UI workflows.

## Decisions

### Decision: Store compliance profile separately from the core user row

A dedicated compliance profile table keeps provider references, country, jurisdiction, sanctions state, and legal-entity context grouped in one place without overloading the core identity row.

Alternatives considered:
- Keep adding columns to `users`: rejected because compliance state and review metadata will grow independently from identity.

### Decision: Store review holds as explicit account restrictions

Restrictions are modeled as separate rows with scope, reason, source, and lifecycle timestamps. This supports both system-imposed compliance holds and future admin review actions.

Alternatives considered:
- Encode restrictions inside a JSON column: rejected because explicit rows are easier to audit and query.

### Decision: Start with deterministic in-process regional policy rules

The first slice uses deterministic region rules in code to evaluate supported capabilities and funding methods. That is sufficient to unblock downstream modules while a richer policy store can be added later.

Alternatives considered:
- Add a policy rules engine now: rejected because it would add complexity before the first capability decisions exist.

## Risks / Trade-offs

- In-code region policies are fast to ship but will need extraction if the matrix grows.
- Internal bootstrap routes are convenient for development but must stay restricted behind the existing bootstrap token.
- Compliance state remains a stub until a real KYC provider integration is added.
