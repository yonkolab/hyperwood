## Why

Deposits now have real transfer state and ledger settlement, but withdrawals are still missing. That leaves funding incomplete and makes the `withdrawal` compliance capability effectively unused.

## What Changes

- Add authenticated withdrawal creation and history reads.
- Reserve requested withdrawal funds in a dedicated hold wallet at request time.
- Add review, failure, and settlement transitions for withdrawals.

## Impact

- Users can request withdrawals without double-spending the same cash elsewhere.
- Review thresholds become executable instead of theoretical.
- Wallet and portfolio totals remain coherent because held cash is still visible as a user-owned balance bucket until final settlement.
