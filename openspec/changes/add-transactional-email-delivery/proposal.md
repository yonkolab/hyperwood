## Why

Hyperwood currently supports email verification as an identity workflow, but it does not have a real outbound email delivery system. Registration and resend flows generate verification challenges, yet there is no provider-backed dispatch, template lifecycle, or delivery attempt tracking.

That leaves a production gap:

- users may never receive verification mail
- operators cannot reason about failed email delivery
- the API has no explicit contract for transactional email behavior

## What Changes

- add transactional email delivery requirements for user onboarding and verification flows
- require provider-backed dispatch for verification emails in production environments
- define delivery-attempt persistence and message lifecycle expectations
- preserve local-development ergonomics without treating inline verification tokens as a production transport

## Impact

- identity onboarding gains a real outbound delivery contract
- future implementation can add a provider abstraction without redefining the product behavior
- local development can remain lightweight while production behavior becomes explicit
