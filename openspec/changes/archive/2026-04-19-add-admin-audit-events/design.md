## Context

The current platform has meaningful internal actions, but they are only visible through the direct resource they mutate. There is no single immutable trail for operators to inspect what happened, who triggered it, and which target resource changed.

## Decisions

### Decision: Use a single append-only administrative audit table

An append-only table with `action`, `actor`, `targetType`, `targetId`, and structured payload is sufficient for the current platform scope and keeps future internal actions easy to integrate.

### Decision: Start with the existing sensitive actions already implemented

The first audit scope should cover:
- compliance profile upserts
- account restrictions
- withdrawal review approval, failure, and settlement
- market status transitions
- market resolution and settlement

### Decision: Expose a read-only internal audit API through operations

Operations already owns the review queue surface. Audit history belongs beside that internal operational API, guarded by the same bootstrap token.

## Risks and Mitigations

- [Audit payloads become inconsistent] Keep the envelope consistent and use typed payload objects per action family.
- [Audit is forgotten in new admin actions] Centralize writes in a reusable service so new actions can call the same helper.
- [Read API becomes too broad] Start with bounded limit and simple filters by target type, target id, and action.
