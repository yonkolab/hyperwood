# Historical Exports

Hyperwood supports authenticated account history exports for the currencies a user trades in.

## Supported export type

Current export jobs are limited to `account_history`.

Each completed export artifact includes:

- the current portfolio summary for the requested currency
- recent fills for that currency
- recent settlements for that currency
- recent ledger activity for that currency

Exports are generated as JSON artifacts and persisted as completed jobs.

## Endpoints

- `POST /api/v1/portfolio/exports`
- `GET /api/v1/portfolio/exports`
- `GET /api/v1/portfolio/exports/:exportJobId`

All export endpoints require:

- `Authorization: Bearer <session-token>`

## Create an export

```bash
curl -X POST http://localhost:3000/api/v1/portfolio/exports \
  -H 'Authorization: Bearer YOUR_SESSION_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{
    "currency": "BRL"
  }'
```

If the body is omitted, the API defaults to the configured platform primary currency.

## List existing exports

```bash
curl "http://localhost:3000/api/v1/portfolio/exports?currency=BRL&limit=10" \
  -H 'Authorization: Bearer YOUR_SESSION_TOKEN'
```

The list is currency-scoped and ordered newest first.

## Fetch a completed artifact

```bash
curl http://localhost:3000/api/v1/portfolio/exports/EXPORT_JOB_ID \
  -H 'Authorization: Bearer YOUR_SESSION_TOKEN'
```

The response returns both export job metadata and the persisted JSON artifact.

## Notes

- Export jobs are currently completed synchronously.
- The artifact format is currently `json`.
- Cross-currency exports are intentionally not merged into a single artifact.
