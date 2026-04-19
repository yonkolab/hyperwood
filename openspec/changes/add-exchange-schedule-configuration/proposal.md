## Why

The admin operations spec already calls out exchange schedules, but the platform has no explicit exchange-wide operating schedule. Clients and operators currently have no dedicated way to understand default trading availability windows or upcoming maintenance closures outside of individual market states.

## What Changes

- add persisted exchange schedule configuration
- add a public endpoint to read the active exchange schedule
- add an internal endpoint to upsert the active exchange schedule
- document and test the schedule workflow

## Impact

- clients can consume a single authoritative exchange availability schedule
- operators can update schedule windows without changing market records individually
- future admin tooling can build on a concrete exchange-wide schedule model
