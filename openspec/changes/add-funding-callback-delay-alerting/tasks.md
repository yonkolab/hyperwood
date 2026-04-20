## 1. Spec Update

- [x] 1.1 Add callback delay alerting deltas to platform security and funding requirements.

## 2. Implementation

- [x] 2.1 Add funding callback delay scanning with a configurable threshold.
- [x] 2.2 Persist callback delay alerts through the shared operations alert model.
- [x] 2.3 Expose an internal route to execute the scan.
- [x] 2.4 Add docs and API coverage for callback delay scanning.

## 3. Validation

- [x] 3.1 Run `openspec validate add-funding-callback-delay-alerting`.
- [x] 3.2 Run lint, docs, type, build, and API validation for the callback delay slice.
