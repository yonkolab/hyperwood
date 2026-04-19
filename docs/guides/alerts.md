# Operational Alerts

Hyperwood persists internal operational alerts for critical platform failures.

Current behavior:

- alerts are generated automatically from critical funding reconciliation discrepancies
- each alert is linked to a source record type and ID
- duplicate alerts for the same source are prevented
- operators can query the alert feed through `GET /api/v1/internal/operations/alerts`

Current alert shape includes:

- `category`
- `severity`
- `status`
- `sourceType`
- `sourceId`
- `message`
- `metadata`

Current categories:

- `funding_reconciliation`

Current limitations:

- alerts are persisted for operator polling, not pushed to PagerDuty, email, or chat systems
- alert acknowledgement and resolution workflows are not implemented yet
- settlement failures, callback delays, and realtime outages are still future alert sources
