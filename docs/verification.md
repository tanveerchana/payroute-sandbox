# Verification record

Local and database checks recorded on 31 October 2026; hosted demo workflow rechecked on 2 November 2026. This is an engineering portfolio demo using synthetic data.

## Local quality checks

- `npm test`: **60 tests pass**, including shared storage/HTTP boundary cases.
- `npm run typecheck`: passes.
- `npm run format:check`: passes.
- `npm run build`: passes.

The checked-in GitHub Actions workflow runs installation, tests, types, formatting and a production build on pushes and pull requests. It does not deploy or receive production credentials.

## Hosted demo workflow check — 2 November 2026

Tested in a new browser tab at https://payroute-sandbox.vercel.app/ using the visible UI. The initial account gate showed Log in, Create account and Try demo. Try demo opened a connected synthetic workspace with 36 transactions.

- Simulated AUD120.50 with reference `Hosted QA 2026-11-02` and the Primary provider outage scenario. The resulting payment was `pay_000037` (shown in the ledger as `py_000037`): Atlas reported provider unavailable after 819 ms; Pulse approved after 197 ms. The timeline showed two attempts and 1,016 ms total latency. The ledger increased to 37 transactions.
- Replayed the unchanged request using the same idempotency key, `sim_20e4daf3d0df4c5b94e3`. The original payment, two attempts and timings were returned; the ledger remained at 37 transactions.
- Ran demo reconciliation. It processed 34 statement records against 37 payments, with 31 matches and three exceptions: duplicate `pay_000003`, missing `pay_000001`, and amount mismatch `pay_000002` (expected 24950 minor units; statement contained 25050).
- Reloaded the page. The connected demo workspace retained 37 transactions, the AUD120.50 payment, its reference and original two-attempt routing timeline. Reconciliation retained the same 31 matches and three exceptions.

`docs/preview.jpg` is a fresh hosted screenshot of the payment details and original routing timeline after reload. No real funds moved. This check used Try demo; real signup email delivery and the complete provider signup/confirmation/login journey remain unverified.

Live demo: https://payroute-sandbox.vercel.app/

## Account security verification

The account migration was applied to the hosted Supabase project on 31 October 2026. Rollback-only SQL assertions passed for cross-workspace/app isolation, viewer secret redaction and write denial, independent app-bound backend credentials, staff job transitions and financial isolation, owner-only membership management, verified-email invitation matching, membership removal, stale revisions, and scoped external ingestion. Two synthetic auth fixtures and all workspace fixtures were created inside the test transaction and rolled back; a follow-up query confirmed zero fixture rows remained.

The application requires both a verified provider session and current database membership. Account and demo transport tests prove that account requests cannot fall back to a demo token. Password exchange, refresh, cookie flags, same-origin checks, and error paths have injected-provider unit coverage. These tests do not establish real email delivery or a complete provider signup/confirmation/login browser run.

## Database boundary

The isolated PostgreSQL workspace table uses SHA-256 capability hashes, row-level security and an atomic revision compare-and-swap. An actual database role test verified owner reads, rejection of cross-token reads, rejection of reads without a token, and rejection of stale writes. Test changes were rolled back. Existing application tables were not changed.

Storage unit tests also exercise racing initialization, mutation conflicts, bounded retries, oversized bodies, invalid credentials and sanitized network errors. Those unit tests use an injected transport; they do not claim to be a hosted load test.

## Verification limits

Desktop browser workflows were exercised manually. Responsive breakpoints and reduced-motion rules are implemented, but dedicated device testing was not performed. Speech recognition, where available, depends on the visitor's browser and was not exercised with a microphone. This demo is not a production security certification, payment integration or real customer operations system. See the README for deliberate limits.
