## Why

The canonical admin operations spec still requires an explicit settlement retry workflow in the internal review queue. The platform can already detect stalled settlements, but operators cannot action those failures through a dedicated operational path.

## What Changes

- add settlement retry items to the internal operations review queue
- add an internal endpoint to retry settlement for a resolved market
- document the retry workflow in the OpenAPI and operator docs
- cover the queue and retry path with API tests

## Impact

- internal operators can review and retry stalled settlements without using the market admin route directly
- stalled-settlement review now matches the admin-and-exchange-operations spec more closely
