# Implementation plan

1. Specify and run failing tests for money parsing, routing, idempotency, settings validation, bounded storage and reconciliation.
2. Implement the deterministic domain reducer and CSV helpers; verify the complete suite.
3. Build the responsive console, routing topology, simulator, payment inspection, settings and settlement UI.
4. Connect the shared workspace API using an isolated bearer token; expose pending/error states and JSON/CSV exports.
5. Run typecheck, production build, domain tests and browser QA. Document local setup, deployment, architecture and sandbox limitations.
