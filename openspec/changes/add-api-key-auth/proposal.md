## Why

Hyperwood já cria, lista e revoga API keys, mas ainda não permite que clientes não interativos se autentiquem com essas credenciais. Isso deixa incompleto o requisito de suporte a usuários avançados e clientes de trading via API.

## What Changes

- Add API key authentication for non-interactive API clients.
- Validate raw API keys against stored hashes, revocation state, and owning user state.
- Support scope checks for API-key-protected routes.
- Add HMAC signing for non-interactive API clients that do not want to send the full API key on each request.
- Record API key usage metadata so later audit and rate-limit layers have a reliable base.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `identity-and-access`: Extend API trading credentials from key management only to actual API key authentication and scoped authorization.

## Impact

- Adds an OpenSpec delta under `openspec/changes/add-api-key-auth/specs/identity-and-access/spec.md`.
- Updates the identity module to authenticate requests with raw API keys and HMAC-signed API requests.
- Introduces protected API-key routes that exercise both auth flows.
