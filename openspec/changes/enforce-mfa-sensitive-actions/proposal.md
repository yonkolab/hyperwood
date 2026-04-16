## Why

Hyperwood already supports TOTP for login challenges, but sensitive account operations still rely only on the active session. That leaves API key creation and revocation weaker than the stated identity requirements.

## What Changes

- Require step-up MFA before selected sensitive identity actions are executed.
- Introduce a short-lived MFA authorization token for sensitive account actions.
- Apply the first enforcement slice to API key creation and API key revocation.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `identity-and-access`: Extend MFA enforcement from login-only challenges to sensitive account actions inside an active session.

## Impact

- Adds an OpenSpec delta under `openspec/changes/enforce-mfa-sensitive-actions/specs/identity-and-access/spec.md`.
- Updates the identity module to issue and consume short-lived MFA action authorizations.
- Protects API key create/revoke routes with step-up MFA when the user has active MFA enabled.
