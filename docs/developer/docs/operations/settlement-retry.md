---
title: Settlement Retry
---

# Settlement Retry

Settlement retry exists for markets that are resolved but still unsettled beyond
the configured threshold.

## Current behavior

- the review queue surfaces retry candidates
- retry uses the existing settlement workflow instead of duplicating logic
- successful and failed retries are auditable
