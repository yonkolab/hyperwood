## Design

Transactional email delivery should be introduced as a dedicated application capability, not as a side effect buried inside identity services.

### Scope

Phase 1 covers transactional verification mail only:

- registration verification
- explicit resend verification requests

Password reset and broader notification categories can build on the same delivery foundation later.

### Delivery model

Production delivery should use a provider-backed transport abstraction so the identity workflow does not depend on a specific vendor implementation.

Expected concepts:

- message type, starting with `email_verification`
- normalized recipient email
- provider reference and provider message identifier when available
- persisted delivery attempt lifecycle such as `queued`, `sent`, `failed`
- template version or render context sufficient for audit and retries

### Identity workflow behavior

Registration and resend flows should:

1. create or refresh the verification challenge
2. dispatch the corresponding transactional message through the provider abstraction
3. return a response that reflects whether delivery was accepted for processing

For local development, the existing developer-friendly inline verification token behavior may remain available outside production, but it should be treated as a development override rather than the primary delivery path.

### Observability boundary

This change does not yet define provider callbacks, bounce handling, or suppression. Those belong in a follow-up change focused on delivery feedback and suppression state.
