## 1. Spec Update

- [x] 1.1 Add a delta spec for suspicious login detection under `identity-and-access`.
- [x] 1.2 Confirm the first heuristic and restriction policy for repeated login failures.

## 2. Implementation

- [x] 2.1 Add persistent login event storage with outcomes and suspicious flags.
- [x] 2.2 Record login outcomes for invalid credentials, MFA challenge issuance, and successful authentication.
- [x] 2.3 Enforce a temporary restriction when repeated failed-attempt thresholds are exceeded.

## 3. Validation

- [x] 3.1 Run typecheck, build, and migration generation.
- [x] 3.2 Validate the OpenSpec change against the updated artifacts.
