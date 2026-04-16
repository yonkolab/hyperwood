## Context

The current login flow validates credentials, optionally issues an MFA challenge, and creates a session. It does not retain structured evidence of failed attempts or slow down repeated abuse.

## Goals / Non-Goals

**Goals:**
- Persist login outcomes for later review and future policy expansion.
- Detect suspicious login behavior using simple repeated-failure heuristics.
- Apply a bounded temporary access restriction once thresholds are exceeded.

**Non-Goals:**
- Full device fingerprinting.
- IP reputation feeds or geovelocity signals.
- Complex adaptive risk engines or SOC workflows.

## Decisions

### Decision: Store normalized login events in a dedicated table

The implementation stores every login outcome with normalized email, optional resolved user ID, IP address, user agent, suspicious flag, and reason.

This keeps the first policy auditable and gives later security slices a stable event base.

Alternatives considered:
- Only log to application stdout: rejected because it is weak for policy queries and review.

### Decision: Use repeated failed attempts per email and per IP as the first heuristic

The first suspicious-login heuristic counts recent failed attempts within a rolling time window by normalized email and by source IP. Crossing either threshold marks the event suspicious and temporarily restricts further logins.

Alternatives considered:
- Wait for device fingerprinting: rejected because the current spec already requires suspicious login handling.

### Decision: Restrict logins temporarily instead of silently adding friction

When thresholds are exceeded, the login request is rejected with a temporary restriction error and the blocked event is recorded as suspicious.

Alternatives considered:
- Add CAPTCHA or email-based step-up immediately: deferred because those flows are not yet part of the identity baseline.

## Risks / Trade-offs

- Shared IPs can accumulate failures faster than a single household or office would prefer.
- The first heuristic is intentionally coarse and may need tuning.
- The added writes on login are acceptable for the current project stage and useful for auditability.
