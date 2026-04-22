## Design

This slice is documentation-only. It does not change runtime behavior.

### Artifact

- `docs/guides/auth-access-matrix.md`

### Access classes

- `public`
- `user_session`
- `user_api_key_raw`
- `user_api_key_hmac`
- `internal_bootstrap`
- `mixed_or_step_up`

### Special-case auth shape

Funding provider callbacks use timestamped HMAC verification instead of user or
operator credentials. The inventory documents that surface separately instead of
forcing it into the user/operator access classes.

### Non-goals

- changing endpoint behavior
- replacing the bootstrap token
- introducing operator identities
