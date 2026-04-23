## Why

Provider-backed email delivery is not sufficient on its own. Hyperwood also needs feedback from the provider to understand whether verification mail was delivered, deferred, bounced, or complained about.

Without delivery feedback and suppression:

- the platform will continue sending mail to unhealthy or complained-about addresses
- operators cannot inspect deliverability failures
- identity flows have no durable signal for whether email transport is degraded

## What Changes

- add signed email-provider webhook requirements for delivery feedback events
- define persistence for delivery, bounce, and complaint events
- add suppression requirements for bounced or complained-about addresses
- require internal visibility into delivery events and suppression state

## Impact

- outbound email becomes operable instead of fire-and-forget
- the platform can stop repeated sends to unhealthy or unsafe recipients
- future provider integrations can plug into a stable webhook and suppression contract
