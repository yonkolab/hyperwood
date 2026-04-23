---
title: Identity and Access Rules
---

# Identity and Access Rules

Core rules:

- new users start pending email verification
- verification delivery returns an explicit delivery outcome for registration and resend
- authenticated trading capabilities require an active account
- sessions are opaque bearer tokens
- sessions have both absolute and idle expiry
- API key management is step-up protected when MFA is enabled
- rotated API keys invalidate prior secret material immediately

## Important consequences

- route auth alone is not enough; downstream services still enforce account status
- step-up authorization is action-scoped, not a general second session
- session management is explicit: list, revoke current, revoke owned session
