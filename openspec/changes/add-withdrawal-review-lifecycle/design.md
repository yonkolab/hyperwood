## Context

The funding transfer table now supports deposits, but outgoing money movement still has no request, review, or payout flow. If withdrawals are added without reserving cash first, a user can request a payout and then spend the same funds on orders before the payout settles.

## Decisions

### Decision: Reserve withdrawal cash immediately

Withdrawal requests move funds from available cash into a dedicated user withdrawal hold wallet. This prevents double-spend while the payout is pending or under review.

### Decision: Route large withdrawals through review

Requests at or above a configured threshold enter `in_review` instead of `pending`. A separate approval action is required before payout settlement can proceed.

### Decision: Keep settlement and failure explicit

Settlement debits the withdrawal hold wallet and credits the platform clearing wallet. Failure returns held funds to available cash through the ledger and records the failure reason on the transfer.

## Risks and Mitigations

- [Held funds disappear from user views] Expose withdrawal hold balances in wallet and portfolio summaries.
- [Settlement replay] Make approval, failure, and settlement idempotent around persisted transfer state.
- [Threshold policy may change later] Keep the threshold as a single service constant for now so it can later move into configuration cleanly.
