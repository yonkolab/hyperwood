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
- `funding_callback_delay`
- `ledger_invariant`
- `market_settlement_failure`
- `realtime_stream_outage`
- `unusual_trading_condition`

Current limitations:

- alerts are persisted for operator polling, not pushed to PagerDuty, email, or chat systems
- alert acknowledgement and resolution workflows are not implemented yet

Internal scan paths now include:

- `POST /api/v1/internal/operations/ledger-invariant-scan`
- `POST /api/v1/internal/operations/settlement-failure-scan`
- `POST /api/v1/internal/operations/trading-condition-scan`
- `POST /api/v1/internal/operations/realtime-stream-health-scan`

The ledger invariant scan currently flags:

- imbalanced ledger transactions
- negative non-platform wallet balances

The settlement failure scan currently flags:

- resolved markets still waiting for settlement beyond `MARKET_SETTLEMENT_FAILURE_MINUTES`

The trading-condition scan currently flags:

- active markets with crossed resting books where the best bid is greater than or equal to the best ask for the same outcome

The realtime stream health scan currently flags:

- public market SSE subscriptions with stale delivery timestamps
- authenticated account SSE subscriptions with stale delivery timestamps
