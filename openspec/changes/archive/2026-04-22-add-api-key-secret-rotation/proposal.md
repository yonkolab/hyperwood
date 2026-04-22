## Why

The platform security spec still requires secret rotation for scoped secrets. The current identity module supports API key creation, revocation, and HMAC signing, but it does not expose a way to rotate API key secret material without deleting the key entirely.

## What Changes

- add an authenticated endpoint to rotate API key secrets
- keep the existing key identity and scopes stable while replacing the secret
- document the rotation behavior for raw API key and HMAC authentication
- add regression coverage proving the old secret is invalid immediately after rotation

## Impact

- API clients can rotate long-lived credentials without changing permission shape
- old raw API keys and HMAC secrets stop working immediately after rotation
