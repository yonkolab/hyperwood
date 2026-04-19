# Webhooks

Webhook endpoints are not implemented in the current codebase.

That means there is currently no documented provider callback surface for:

- funding provider settlement callbacks
- reconciliation provider notifications
- market lifecycle events

## Current recommendation

When webhook support is added, document it as a separate section of the OpenAPI or with AsyncAPI-style complementary docs, including:

- signature verification
- retry semantics
- idempotency handling
- event versioning
- delivery guarantees

Until then, this guide remains a marker that webhook behavior is future work, not current platform behavior.
