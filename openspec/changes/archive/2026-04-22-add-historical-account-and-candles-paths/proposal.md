## Why

Hyperwood already supports account export jobs and archived market trades, but the canonical historical-data spec still calls for dedicated historical access paths for orders, fills, and charts. Those paths are still missing.

## What Changes

- add authenticated historical account order and fill endpoints
- add archived market candle endpoint
- document the new historical paths
- add API coverage for historical account records and candle output

## Impact

- closes the remaining concrete historical access gap for orders, fills, and charts
- keeps archival reads on dedicated paths without requiring new storage tables
