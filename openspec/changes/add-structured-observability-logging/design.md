## Overview

This slice implements request-scoped correlation and structured workflow logging.

## Correlation

- the API accepts an optional `x-request-id` header
- if absent, the server generates a request ID
- the request ID is returned on responses and included in structured workflow logs

## Structured Workflow Logs

The runtime emits structured logs for critical workflow milestones in:

- order creation, amendment, and cancellation
- funding deposit and withdrawal creation and review/settlement actions
- matching runs
- market resolution and settlement

Each log includes the request ID plus the most relevant domain references such as user, market, order, transfer, or settlement identifiers.

## Scope

This slice does not add an external metrics backend or alert transport. It establishes the in-process structured logging contract and correlation propagation needed for later observability work.
