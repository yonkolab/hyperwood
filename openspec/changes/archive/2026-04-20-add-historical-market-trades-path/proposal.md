## Why

The historical-data spec still lacks a dedicated access path for archived market trades. Live market routes currently serve trades for any market lifecycle state, which does not separate operational reads from archived reads.

## What Changes

- add a dedicated historical market trades endpoint
- reject live trade reads for archived markets and direct clients to the historical path
- document and test the archival-boundary behavior

## Impact

- gives clients a clear archival path for settled, voided, and cancelled markets
- keeps the live market trades route focused on operational market access
