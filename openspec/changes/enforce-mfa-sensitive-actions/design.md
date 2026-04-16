## Context

The current identity slice enforces TOTP during login when the user has an active factor. Once a session exists, the same user can still create or revoke API keys without another proof of possession.

## Goals / Non-Goals

**Goals:**
- Require a fresh MFA proof before sensitive account actions.
- Keep the implementation small and reusable for later sensitive operations.
- Reuse the current TOTP factor model instead of inventing a second MFA mechanism.

**Non-Goals:**
- Mandatory MFA enrollment for every user.
- Device binding, passkeys, or hardware security keys.
- Broader policy engines for adaptive risk scoring.

## Decisions

### Decision: Use short-lived MFA action authorization tokens

The implementation issues a dedicated short-lived authorization token after a valid TOTP code is verified inside an authenticated session. Sensitive routes then consume that token before executing the action.

This avoids asking for the TOTP code directly on every protected route and keeps the route contract explicit for future non-browser clients.

Alternatives considered:
- Ask every sensitive route for a raw TOTP code: rejected because it spreads MFA verification logic across routes.
- Reuse the login challenge token: rejected because login and in-session sensitive actions have different lifecycles and trust boundaries.

### Decision: Enforce the first slice on API key management

The first protected actions are API key creation and revocation, because those credentials can later authorize trading clients and are clearly security-sensitive.

Alternatives considered:
- Apply step-up MFA to all session-authenticated routes immediately: rejected because it adds friction to low-risk reads without improving the initial security posture proportionally.

### Decision: Require step-up only when the user has active MFA enabled

Current enforcement applies to users who already have an active verified TOTP factor. This matches the existing spec language and avoids silently introducing mandatory MFA enrollment in the same slice.

Alternatives considered:
- Reject all sensitive actions unless MFA is enabled: deferred to a future policy slice if Hyperwood decides to make MFA mandatory for API credential management.

## Risks / Trade-offs

- The extra authorization step adds client complexity for API key management.
- One-time authorization tokens add more short-lived state in the database, but the model is simple and auditable.
- Users without MFA enabled remain able to manage API keys until a stricter enrollment policy is specified.
