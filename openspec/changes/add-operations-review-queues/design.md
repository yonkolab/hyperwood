## Context

The canonical admin operations spec requires review queues for sensitive workflows, but the implementation only exposes action endpoints. Operators can approve or fail a known withdrawal and can list raw discrepancies, yet there is no purpose-built queue for active review work.

## Decisions

### Decision: Create a dedicated operations read surface

Operational review is an internal concern, not a user funding concern. A separate internal operations route keeps those reads out of the public funding API and gives room for more review queues later.

### Decision: Return two queue sections in one response

Withdrawal reviews and reconciliation investigations are both active operational workloads. Returning them from one route gives operators a single polling surface while keeping each item type explicit.

### Decision: Include triage context, not raw joined tables

Operators need enough context to act: user identity summary, funding method details, transfer amounts, review reasons, and discrepancy metadata. The route should shape the response around those decisions instead of mirroring table rows.

## Risks and Mitigations

- [Queue grows across domains] The response keeps separate arrays per queue type, so later additions do not break existing consumers.
- [Insufficient review context] Withdrawal items include user and funding method summaries plus persisted review metadata.
- [Operations endpoints leak into public surface] The route stays under the internal bootstrap-protected namespace.
