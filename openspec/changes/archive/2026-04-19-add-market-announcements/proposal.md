## Why

The admin operations spec already requires publishing announcements, but the current market surface has no way for operators to publish status notices or explanatory messages to market participants. That leaves lifecycle changes like halts, disputes, or settlement notices without a first-class public communication path.

## What Changes

- add persisted market announcements tied to a market
- add an internal publish endpoint for operators
- add a public read endpoint for clients
- include announcement publishing in the admin audit trail
- document and test the new market announcement workflows

## Impact

- operators can publish market-specific notices without editing core market records
- clients can fetch announcement history separately from market detail
- sensitive admin communications gain explicit persistence and auditability
