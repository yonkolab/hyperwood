## Overview

The scan will run as an internal bootstrap-token-protected operation. It reads current ledger and wallet state, identifies invariant failures, stores one alert per offending source, and returns the detected issues in the response.

## Detection rules

### Imbalanced ledger transactions

Each ledger transaction is expected to have balanced debit and credit totals. The scan flags any transaction where:

- total debits differ from total credits, or
- the transaction spans more than one currency

### Negative user wallet balances

User wallet accounts should not become negative. The scan flags any non-platform wallet account whose current derived balance is below zero.

## Alert shape

- category: `ledger_invariant`
- severity: `critical`
- sourceType:
  - `ledger_transaction`
  - `wallet_account`
- sourceId:
  - transaction id
  - wallet account id

Alerts remain deduplicated by the existing unique `(sourceType, sourceId)` constraint.

## API

- `POST /api/v1/internal/operations/ledger-invariant-scan`
  - optional body:
    - `limit`
  - response:
    - generated timestamp
    - number of newly created alerts
    - imbalanced transactions
    - negative wallet balances
