## Why

Hyperwood exposes current portfolio summaries, fills, settlements, and ledger-derived reads, but there is still no dedicated historical export path. That leaves the realtime-and-historical-data spec unimplemented for account history exports.

## What Changes

- Add persisted account history export jobs for authenticated users.
- Generate JSON account history export artifacts from the current portfolio and activity model.
- Add authenticated endpoints to create, list, and fetch export jobs.
- Document and test the export workflow.

## Impact

- Users gain a dedicated historical access path for account history.
- The realtime-and-historical-data spec gains its first executable export workflow.
- Later archival or async delivery work can extend the same job model instead of replacing it.
