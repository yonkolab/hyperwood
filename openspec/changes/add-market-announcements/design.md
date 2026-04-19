## Overview

This slice introduces market-scoped announcements as a lightweight communications layer for market administration.

## Data Model

Each announcement belongs to a single market and stores:

- title
- message
- publisher identifier
- published timestamp

Announcements are immutable after publication in this slice. If later operational needs require edits or withdrawals, those should be modeled as follow-up changes rather than silent mutation.

## API Shape

- `POST /api/v1/internal/markets/:marketId/announcements`
  publishes a new market announcement
- `GET /api/v1/markets/:marketId/announcements`
  returns market announcements ordered newest first

## Audit

Publishing an announcement is a sensitive internal action and should create an administrative audit event.

## Notes

This slice is intentionally market-scoped. Event-wide or platform-wide announcements can be added later if there is a real product need.
