## Context

The market lifecycle enum already includes `halted`, `trading_closed`, and `disputed`, but there is no internal API for applying those states and no persisted history of when or why they changed. Existing trading and settlement logic already relies on market status checks, so adding a first-class transition workflow is the smallest high-value next step.

## Decisions

### Decision: Use a dedicated transition table

Market status changes should be preserved as durable records with `fromStatus`, `toStatus`, `reason`, `changedBy`, and timestamps. Relying only on the current `status` field and `statusChangedAt` loses operational history.

### Decision: Add one internal status transition endpoint

Rather than adding separate halt, resume, dispute, and close routes, one internal endpoint should accept the target status and validate it against explicit allowed transitions.

### Decision: Keep settlement and resolution endpoints authoritative for final outcomes

The admin status endpoint should handle operational lifecycle states such as `halted`, `active`, `trading_closed`, `disputed`, and `cancelled`. Final settlement states like `settled` and `voided` should remain controlled by the existing settlement workflow.

## Risks and Mitigations

- [Too-permissive state changes] Restrict transitions through a validated allowlist instead of accepting arbitrary enum changes.
- [History diverges from current status] Write the transition record and update the market in the same transaction.
- [Settlement runs during dispute] Treat `disputed` as a non-settleable state in the existing settlement service, and add an API test for that path.
