## Context

Hyperwood is a new prediction market API project with a large PRD but no existing implementation or spec baseline. The PRD covers both user-facing requirements and infrastructure guidance, so the main design task here is to translate that document into capability specs that are precise enough to drive implementation without forcing the entire system into a single monolithic spec file.

## Goals / Non-Goals

**Goals:**
- Convert `PRD.md` into an initial OpenSpec baseline for Hyperwood.
- Split requirements into stable capability boundaries that align with likely service and module seams.
- Preserve the PRD's core priorities: correctness, auditability, deterministic trading behavior, and compliance-aware funding flows.
- Make future changes incremental by giving each concern its own spec folder.
- Make kickoff planning explicit by confirming the first core requirement with the user before implementation starts.

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

### Decision: Start implementation from a confirmed core requirement

When work starts, Hyperwood should not assume that every baseline capability is equally refined. The implementation kickoff should explicitly confirm the first core requirement with the user, and identity and access should be treated as the default day-1 checkpoint because it gates production trading and privileged API access.

Alternatives considered:
- Start coding from the roadmap alone: rejected because some baseline capabilities are intentionally broad and need confirmation before implementation.

### Decision: Allow large capabilities to split into deeper sub-specs

Some baseline capabilities, especially identity, funding, compliance, and settlement, may grow too large for a single spec file. Those capabilities should be decomposed into follow-up change specs or deeper sub-specs before implementation if the current boundary becomes too coarse.

Alternatives considered:
- Keep every concern in one top-level capability spec: rejected because it would create oversized specs that are hard to refine and implement safely.

## Risks / Trade-offs

- Capability boundaries may need refinement as the codebase emerges -> Future delta changes can split or merge capabilities once implementation ownership is clearer.
- Some capabilities may become too large for one spec -> Break them into more detailed follow-up specs before implementation begins on that area.
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
- Which core requirement should be refined first at implementation kickoff after identity and access is confirmed?
