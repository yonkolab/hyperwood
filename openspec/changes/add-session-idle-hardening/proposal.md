## Why

The platform security spec still calls for strong session management. The current bearer sessions support explicit revocation and listing, but they do not enforce inactivity expiry and they do not refresh activity timestamps during authenticated use.

## What Changes

- add a configurable inactivity timeout for bearer sessions
- refresh session activity timestamps during authenticated use
- expose `idleExpiresAt` in session listings
- add regression coverage for idle-expired session rejection

## Impact

- stale bearer sessions are rejected automatically
- clients can reason about both absolute expiry and inactivity expiry
