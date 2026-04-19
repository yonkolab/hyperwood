## Why

The admin operations spec already calls out exchange fee tables, but the platform has no dedicated source for active exchange fees by currency. Clients and operators currently cannot retrieve an authoritative fee schedule through the API.

## What Changes

- add persisted exchange fee schedule configuration
- add a public endpoint to read active exchange fees
- add an internal endpoint to publish a new fee schedule
- document and test the fee schedule workflow

## Impact

- clients can retrieve current maker and taker fees without hardcoding them
- operators can publish fee changes with versioned effective timestamps
- future billing and settlement workflows can reference a concrete fee schedule record
