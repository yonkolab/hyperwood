## Design

API key rotation reuses the existing `api_keys` table row instead of creating a second key record.

Rotation semantics:

- keep `api_keys.id`
- keep `keyPrefix`
- keep `scopes`
- replace `secretHash`
- replace `secretEncrypted`

This makes the secret change atomic while preserving references and operator understanding of the key identity.

### Endpoint

`POST /api/v1/auth/api-keys/:apiKeyId/rotate`

- requires the bearer session
- reuses the same MFA authorization rule as key creation and revocation
- returns the new raw API key once

### Authentication effects

- old raw key no longer matches `secretHash`
- old HMAC secret no longer matches decrypted secret material
- the new raw key and HMAC secret work immediately
