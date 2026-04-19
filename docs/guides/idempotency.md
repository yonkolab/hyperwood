# Idempotency

Idempotency is currently implemented for order creation.

## Order creation

Endpoint:

- `POST /api/v1/orders`

Required header:

```http
idempotency-key: <stable-client-key>
```

Behavior:

- same key + same payload returns the original order result
- same key + different payload returns a conflict
- a successful replay returns HTTP `200`
- a first successful submission returns HTTP `201`

This lets clients safely retry order submission on network failure without creating duplicate resting orders.

## Current scope

Implemented:

- order creation idempotency

Not yet implemented:

- deposit creation idempotency
- withdrawal creation idempotency
- internal mutation idempotency

Recommended future work:

- standardize an idempotency contract for all write endpoints
- document key retention windows
- return replay metadata consistently across domains
