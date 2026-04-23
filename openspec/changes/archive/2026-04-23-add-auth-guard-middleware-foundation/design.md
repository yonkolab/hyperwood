## Design

This slice adds behavior-preserving route guards and request auth context.

### Shared guards

- `requireSessionAuth`
- `requireInternalAuth`
- `requireStepUpAuthorization(action)`

### Request auth context

Guards populate a typed `request.auth` value:

- `public`
- `session`
- `api_key` (reserved for the later API-key middleware slice)
- `internal`

Session context stores:

- resolved user
- presented session token
- optional step-up action token metadata

Internal context stores:

- the current internal actor model, initially `bootstrap`

### Migration scope

This slice migrates:

- `identity` session and internal routes
- `funding`
- `orders`
- `portfolio`
- `compliance`
- `exchange`
- `markets`
- `operations`

API-key raw and HMAC routes remain on their current helpers for now.

### Non-goals

- replacing bootstrap-token auth
- introducing operator identities or permissions
- changing the domain rules for MFA authorization
