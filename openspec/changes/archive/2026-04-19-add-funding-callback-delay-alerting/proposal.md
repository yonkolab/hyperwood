## Why

Hyperwood can now ingest signed funding provider webhooks, but there is still no executable way to detect when expected callbacks never arrive. That leaves funding transfers able to stall silently in `pending` or `in_review`.

## What Changes

- Add a funding webhook delay scan for provider-backed transfers.
- Create persisted operational alerts for delayed callbacks.
- Add an internal route to execute the scan and inspect created alerts.
- Document and test the delay alert workflow.

## Impact

- Operators can detect funding transfers that appear stuck waiting on provider callbacks.
- The platform security alerting requirement gains concrete callback-delay coverage.
- The alerting foundation expands without introducing an external monitoring dependency.
