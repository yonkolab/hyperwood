## Context

Hyperwood is a new prediction market API project with a large PRD but no existing implementation or spec baseline. The PRD covers both user-facing requirements and infrastructure guidance, so the main design task here is to translate that document into capability specs that are precise enough to drive implementation without forcing the entire system into a single monolithic spec file.

## Goals / Non-Goals

**Goals:**
- Convert `PRD.md` into an initial OpenSpec baseline for Hyperwood.
- Split requirements into stable capability boundaries that align with likely service and module seams.
- Preserve the PRD's core priorities: correctness, auditability, deterministic trading behavior, and compliance-aware funding flows.
- Make future changes incremental by giving each concern its own spec folder.

**Non-Goals:**
- Finalize endpoint-by-endpoint API contracts.
- Lock in provider vendors or jurisdiction decisions that remain open in the PRD.
- Replace the PRD as the long-form background document.
- Describe implementation details at code or schema migration level.

## Decisions

### Decision: Split the PRD into capability-oriented specs

The PRD mixes product, operational, and architecture concerns. Hyperwood needs specs that can evolve independently, so the baseline is split into ten capabilities instead of preserving the PRD as a single document.

Alternatives considered:
- One large platform spec: rejected because future changes would be noisy and hard to review.
- A spec per PRD heading: rejected because that would create too many shallow specs with poor ownership.

### Decision: Keep architecture guidance in `design.md`, not in the requirement files

The PRD recommends a Node.js and TypeScript modular monolith with PostgreSQL, Redis, BullMQ, and WebSockets. That guidance matters, but it belongs in design context and future implementation changes, while the spec files focus on externally meaningful behavior.

Alternatives considered:
- Encode architecture as normative requirements: rejected because it would over-constrain implementation before code exists.

### Decision: Model funding and ledger concerns together in the baseline

For Hyperwood, funding, balances, reservations, and reconciliation are inseparable. The baseline keeps them in one capability so money movement invariants stay visible in one place.

Alternatives considered:
- Separate funding and ledger specs: rejected for the initial baseline because it obscures end-to-end money flow guarantees.

### Decision: Separate trading from matching

Order entry behavior and matching engine internals change at different rates. The baseline gives user-facing trading semantics and engine-level market behavior separate specs.

Alternatives considered:
- Merge them into one trading spec: rejected because it couples API semantics to engine evolution.

## Risks / Trade-offs

- Capability boundaries may need refinement as the codebase emerges -> Future delta changes can split or merge capabilities once implementation ownership is clearer.
- Some PRD areas intentionally remain high level -> Follow-up specs should refine API contracts, schemas, and provider workflows once open decisions are resolved.
- Duplicating the baseline into both a change and main specs introduces short-term duplication -> This is acceptable to establish a usable `openspec/specs/` baseline immediately.

## Migration Plan

- Create the bootstrap change and its capability specs from the PRD.
- Sync the same capability specs into `openspec/specs/` as the main project baseline.
- Validate both the change and the main specs with `openspec validate`.
- Use future changes to evolve individual capabilities as implementation work starts.

## Open Questions

- Which jurisdictions are in scope for launch?
- Which funding rails are mandatory for v1 versus optional by region?
- Will API trading be first-class at launch or phased in after the initial retail workflow?
- What dispute process and reviewer roles will govern market resolution in production?
