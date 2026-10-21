# Remaining work: four-person execution plan

Updated 2026-10-21. This plan uses the stricter seven-phase checklist discussed after the original Phase 0–3 milestones. It describes work **not yet proven**, rather than renaming Reference Wallet results as all-Inji results.

## Current baseline and finish line

The playground already runs Certify → Reference Wallet → Verify for SD-JWT and JSON-LD, records sanitized exchanges, replays faults, exports reports and a matrix, and runs independent mock issuer/verifier services. The X.509 mock issuer passed the public Collab Verify path. `pnpm test`, `pnpm build`, and `pnpm typecheck` passed at the Phase 3 checkpoint; see [PHASE3.md](PHASE3.md).

The remaining mandatory evidence is: an **Inji wallet** issuing, holding, and presenting JSON-LD and SD-JWT to Inji Verify (A1/A2); browser-side exchange capture without changing signed protocol values (FR-40); a usable assisted Inji Web path for its supported format (FR-25); and one-command playground packaging (A6). A dedicated persistent Inji Web test account is not currently available. Current Inji Web documentation limits OpenID4VP presentation to JSON-LD, so plan SD-JWT validation with a suitable Inji mobile wallet version. A blocked external test must be reported as blocked, never marked passed.

The four workstreams below can start in parallel. They should use separate local copies and **must not create branches** until the user changes that rule. One integrator serializes reviewed commits and pushes to `main`; each developer pulls the latest `main` before handing over a patch or committing. No one edits another person's owned files without coordinating first. The integrator alone reconciles `README.md`, `SRS.md`, `decisions.md`, and the final acceptance report.

Suggested timebox with four developers: one day to freeze the exchange contract and start the four tracks, two to three days of parallel implementation, then one to two days for serial integration, mock smoke tests, and documentation. Live A1/A2 validation has no reliable estimate until the test account and wallet/device are available; do not use the timebox to declare those checks passed.

## Research worth using

| Repository | Relevant pattern | What to apply here | Boundary |
|---|---|---|---|
| [centre-for-dpi/verifiably](https://github.com/centre-for-dpi/verifiably) | A vendor-neutral `backend.Adapter` drives issuer, wallet, and verifier UI across Inji and other stacks. | Keep our role drivers and capability matrix separate from the React presentation; show the exact tested provider/version per run. | Its deployed versions and protocol adapters do not prove our Collab contracts. Do not copy its UI or code. |
| [EWC Interoperability Test Bed](https://github.com/EWC-consortium/ewc-wallet-conformance-backend) | Config-driven issuer and verifier cases plus a companion wallet client cover auth-code, pre-authorized, SD-JWT, and several VP modes. | Store synthetic scenario definitions and expected outcomes as fixtures; test one protocol variable at a time. | It targets its own profiles. Adapt test structure, not endpoint assumptions or test keys. |
| [walt.id Community Stack](https://github.com/walt-id/waltid-identity) | Separate issuer, wallet, and verifier services with a Docker Compose walkthrough. | Build `core` and `mocks` Compose profiles and a smoke run before attempting a full local Inji stack. | Current walt.id APIs use final 1.0 protocols; our Collab deployment has its own draft-era behavior. |
| [Inji Web](https://github.com/inji/inji-web) and [Inji Wallet SD-JWT presentation guide](https://github.com/inji/inji-wallet/blob/master/docs/sdjwt-vp-support.md) | Web currently presents JSON-LD; the mobile-wallet guide describes SD-JWT key binding and presentation. | Route A1 through a logged-in Web wallet if a test account becomes available; investigate mobile for A2. Record the exact app build and credential format used. | Documentation is a capability lead, not a live pass. |

## Shared contract before parallel work

Freeze the existing `RunConfig`, `RunStep`, and `Exchange` types in `packages/shared` for the first parallel pass. Captured browser traffic must enter the same redacted `Exchange` representation used by the inspector: run id, step id, actors, method, URL, status, duration, sequence, sanitized request/response, and redaction paths. Never persist raw HAR files, bearer tokens, cookies, pre-authorized codes, OTPs, private keys, or complete credentials. The capture owner proposes any required type/API change in a short contract note; the integrator applies that shared change once, after the four independent deliverables are ready.

Each developer gives the integrator: a short change summary, files changed, command outputs, a sanitized example or screenshot where useful, and remaining blockers. A test passing in fixture mode is labeled fixture evidence. A Reference Wallet result is labeled Reference Wallet evidence.

## Person 1 — protocol capture and safe evidence

**Implementation status:** backend passive-HAR import, sanitizer, run mapping, storage, and fixture/API tests are implemented. See [CAPTURE.md](CAPTURE.md). A live Inji Web capture still depends on the real-wallet workstream and a dedicated test account.

**Owns:** new `apps/bff/src/capture/` files, capture-specific tests, and narrowly scoped changes to `apps/bff/src/redaction.ts` and `apps/bff/src/store.ts`. Coordinate any route in `apps/bff/src/app.ts` with the integrator. Do not edit `apps/web/` or wallet drivers.

1. Compare a passive browser-network/HAR import with a transparent proxy. Choose a path that leaves issuer identifiers, audiences, request URIs, redirects, and signed request objects unchanged. A rewriting `/tap/...` proxy does **not** meet this condition.
2. Implement a bounded, allowlisted import/observer path for **synthetic test traffic only**. Parse and redact before persistence or WebSocket emission. Reject oversized, malformed, cross-run, and non-allowlisted traffic. Avoid logging raw error bodies.
3. Map captured Mimoto, Certify, eSignet, and Verify requests to the existing run/step/exchange model. Mark gaps when the capture method cannot see a boundary; do not claim every exchange was captured without evidence.
4. Test redaction for headers, URL query values, JSON/form bodies, nested JWK private fields, and malformed input. Verify the database and API contain only sanitized values.

**Done when:** a browser mock-flow fixture can be imported/observed without changing any protocol URL or body, its safe exchanges appear under the correct run, and negative redaction tests pass. Live Inji Web capture is a later integration check with Person 2.

## Person 2 — real-wallet journey and assisted UI

**Owns:** `apps/web/src/` and new `apps/bff/src/drivers/injiWebAssisted.ts` plus driver-specific tests. Leave capture internals, mocks, Compose, and shared schemas to their owners. Use a fixture matching the frozen `Exchange` shape until Person 1's capture path is integrated.

1. Add a guided JSON-LD Inji Web journey: start an assisted run, open the wallet, show the verifier request/QR or same-device link, wait for observed issuance and presentation checkpoints, and show a truthful timeout/error state.
2. In the selector, distinguish supported JSON-LD Web presentation, unavailable SD-JWT Web presentation, and the automated Reference Wallet. Never relabel one wallet as another.
3. Keep credentials and login state in Inji Web/Mimoto; the playground stores only redacted exchange evidence and normalized outcome. Add mock-driven UI/driver tests for waiting, completion, cancellation, and timeout.
4. Prepare a manual A1 checklist for a **dedicated persistent test account**. The user said none is available now, so complete the fixture path and record live A1 as blocked until a test account exists.

**Done when:** the assisted UI and state machine pass fixture tests and can consume Person 1's redacted capture contract. A1 is signed off only after a real Inji wallet stores and presents a JSON-LD VC to Verify; guest download alone does not count.

## Person 3 — protocol correctness and real-wallet evidence

**Owns:** `apps/mock-issuer/`, `apps/mock-verifier/`, `apps/bff/src/tamper/`, new `spikes/wallet-interop-*` scripts/fixtures, and a separate `WALLET_VALIDATION.md`. Avoid `apps/web/`, capture files, Compose, and shared docs.

1. Replace the current “expired” test with a **deliberately issued, validly signed expired credential** from the mock issuer. The present `exp` mutation breaks the issuer signature, so it cannot isolate expiry enforcement. Do the same for wrong-type tests if the goal is to isolate type rather than signature failure.
2. Add an explicit required-disclosure policy to the mock verifier before asserting that a missing disclosure is invalid; an omitted optional claim is not a valid negative test.
3. Probe a pinned Inji mobile wallet build for Certify → Inji Wallet → Verify SD-JWT (A2), then JSON-LD if feasible. Record issuance, holder binding, direct-post shape, verifier result, version/draft, and **sanitized** failure evidence. Do not commit real credentials, OTPs, HAR files, or private keys.
4. Keep the X.509 issuer success separate from trust-chain assurance. If exploring trust, use a configured test trust anchor and make that a separate result, not an inference from the self-signed Collab pass.

**Done when:** negative cases identify the intended validation failure independently, and `WALLET_VALIDATION.md` gives a reproducible pass or an exact external blocker for A2. A Reference Wallet pass cannot close A2.

## Person 4 — packaging, CI, and release checks

**Owns:** `docker-compose.yml`, Dockerfiles, `.dockerignore`, `.github/workflows/`, new `e2e/` smoke tests, and `DEPLOYMENT.md`. Avoid app source files; request any required health/config hook from the integrator.

1. Package the web, BFF, issuer, verifier, and PostgreSQL. Make `core` and `mocks` profiles work with health checks, dependency readiness, migration deployment, and synthetic-only defaults. Treat a full local Inji profile as a separate opt-in goal requiring pinned upstream images/configuration.
2. Add CI for install, strict typecheck, unit/contract tests, build, and a Compose-backed mock smoke flow. Add one browser happy-path smoke test if the runner budget supports it; otherwise document and automate the HTTP path first.
3. Verify `docker compose --profile core --profile mocks up --build` opens one URL and runs a mock happy path (A6). Report actual component versions/labels; do not invent versions for Collab services.
4. Write `DEPLOYMENT.md` with startup, shutdown, required ports, synthetic-data setup, and the difference between fixture, mock, and Collab modes. Do not put secrets in images or the repo.

**Done when:** a clean machine can start the playground with Compose, CI passes, the mock smoke run completes, and a reviewer can reproduce it from `DEPLOYMENT.md`.

## Integration sequence and release gate

1. **Parallel development:** all four people work in their owned areas against the frozen types and synthetic fixtures. Person 2 can finish the guided UI before a real wallet account exists; Person 3 can finish negative-case correctness before a mobile device is ready.
2. **Serial integration on `main`:** the integrator applies one workstream at a time, resolves the shared capture/API seam, runs `pnpm test`, `pnpm build`, `pnpm typecheck`, a Compose mock smoke, and checks redaction. No new branches or concurrent pushes to `main`.
3. **External validation:** run A1 only with a dedicated logged-in Inji Web test account; run A2 with a pinned capable Inji mobile wallet. Capture the exact Verify result and keep any unavailable test marked blocked.
4. **Final evidence:** update the compatibility matrix and reports from real run records, reconcile the stale planning language in `SRS.md`/`TRD.md`, record reproducible version labels, make a 3–5 minute demo, and publish the gap write-up. A release is ready when A1, A2, A6 and the redaction checks have evidence, or when the user explicitly accepts named external blockers as the release boundary.

## Extra research after the mandatory path

- Compare draft-era Collab behavior with final OpenID4VCI/OpenID4VP implementations using one versioned fixture per provider; avoid treating endpoint names as universal.
- Add a credential decoder and lazy-load exchange bodies after the all-Inji and packaging gates. The current UI fetches all redacted exchanges while polling.
- Test a trust-store-backed verifier, issuer certificate chain validation, and revocation independently of signature validity.
- Add side-by-side run comparison and QR-capacity probes only after A1/A2/A6 are reproducible.

These are follow-ups, not prerequisites for the four parallel workstreams.
