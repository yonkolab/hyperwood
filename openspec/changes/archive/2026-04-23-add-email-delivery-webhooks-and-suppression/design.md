## Design

This change builds on transactional email delivery and adds provider feedback plus suppression behavior.

### Signed webhook model

The platform should expose a provider callback endpoint for transactional email status changes.

Expected properties:

- signed request verification before applying side effects
- idempotent event handling
- persisted raw provider event reference or normalized event payload
- request correlation data for investigation

### Delivery event normalization

Provider callbacks should normalize external statuses into internal delivery event categories such as:

- `delivered`
- `deferred`
- `bounced`
- `complained`

The exact provider payload can vary, but the internal model should remain stable.

### Suppression behavior

Bounce and complaint feedback should create recipient suppression state keyed by normalized email.

Expected suppression semantics:

- future transactional sends to a suppressed address are blocked according to policy
- suppression reason and source event remain inspectable
- operator review can distinguish bounce-based and complaint-based suppression

### Operational visibility

Operators should be able to inspect delivery events and suppression records through an internal surface. This keeps deliverability issues actionable instead of hidden inside provider dashboards.

### Phase boundary

This change does not require bulk marketing email features. It is limited to transactional delivery feedback for identity and future account-critical communications.
