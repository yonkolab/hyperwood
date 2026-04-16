## 1. Spec Update

- [x] 1.1 Add a delta spec for API key authentication under `identity-and-access`.
- [x] 1.2 Confirm the scope and header format for raw and HMAC-based non-interactive auth flows.

## 2. Implementation

- [x] 2.1 Add API key authentication and scope validation to the identity service.
- [x] 2.2 Add a protected route that authenticates with API keys and returns the caller identity.
- [x] 2.3 Update API key usage metadata on successful authentication.
- [x] 2.4 Add HMAC verification with timestamp validation for signed API requests.

## 3. Validation

- [x] 3.1 Run typecheck and build.
- [x] 3.2 Verify the change remains aligned with the identity-and-access spec.
