## MODIFIED Requirements

### Requirement: Internal operator controls and auditability
The system MUST provide privileged operational controls with immutable audit trails, schedule and fee configuration, and operational alert visibility.

#### Scenario: Operator lists active alerts
- **WHEN** an internal operator queries the alert feed
- **THEN** the system returns matching persisted alerts ordered from newest to oldest
- **AND** each alert includes severity, category, source linkage, message, and current status
