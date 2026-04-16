## 1. Spec Update

- [x] 1.1 Add a delta spec for MFA-gated sensitive actions under `identity-and-access`.
- [x] 1.2 Confirm which identity routes require step-up MFA in the first slice.

## 2. Implementation

- [x] 2.1 Add a short-lived MFA action authorization model and service flow.
- [x] 2.2 Add a route that verifies TOTP for a named sensitive action and returns an authorization token.
- [x] 2.3 Require a valid MFA action authorization when creating or revoking API keys for users with active MFA.

## 3. Validation

- [x] 3.1 Run typecheck, build, and migration generation.
- [x] 3.2 Validate the OpenSpec change against the updated artifacts.
