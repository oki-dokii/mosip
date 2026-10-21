# Remaining work: four-person execution plan

Updated 2026-10-22. This plan uses the stricter seven-phase checklist discussed after the original Phase 0–3 milestones. It describes work **not yet proven**, rather than renaming Reference Wallet results as all-Inji results.

## Current baseline and finish line

The playground already runs Certify → Reference Wallet → Verify for SD-JWT and JSON-LD, records sanitized exchanges, replays faults, exports reports and a matrix, and runs independent mock issuer/verifier services. The X.509 mock issuer passed the public Collab Verify path. `pnpm test`, `pnpm build`, and `pnpm typecheck` passed at the Phase 3 checkpoint; see [PHASE3.md](PHASE3.md).

The remaining mandatory evidence is: an **Inji wallet** issuing, holding, and presenting JSON-LD and SD-JWT to Inji Verify (A1/A2); browser-side exchange capture without changing signed protocol values (FR-40); and a usable assisted Inji Web path for its supported format (FR-25). The one-command playground-and-mocks slice of A6 passed locally and in hosted CI; a clean-machine rehearsal and a local Inji profile remain. A dedicated persistent Collab Inji Web test account is not currently available. Current Inji Web documentation limits OpenID4VP presentation to JSON-LD, so plan SD-JWT validation with a suitable Inji mobile wallet version. A blocked external test must be reported as blocked, never marked passed. The [five-day catch-up plan](CATCH_UP.md) now makes a pinned local Inji profile the primary live-integration target after the core playground/mocks Compose path.

The four workstreams below can start in parallel. They should use separate local copies and **must not create branches** until the user changes that rule. One integrator serializes reviewed commits and pushes to `main`; each developer pulls the latest `main` before handing over a patch or committing. No one edits another person's owned files without coordinating first. The integrator alone reconciles `README.md`, `SRS.md`, `decisions.md`, and the final acceptance report.

**Preserve contributor history without branches.** The current history has one author. Each developer should make several focused commits with their own Git name/email in their separate copy, then send `git format-patch` files. The integrator reviews and applies them in order with `git am`, which retains the original commit author. Alternatively, schedule one developer at a time to commit directly to `main` with their own identity. Do not squash, impersonate another contributor, or rewrite submitted history. Record a short handoff note with patch commit IDs and the test result. The integrator remains responsible for the final push, not for claiming sole authorship.

Suggested timebox with four developers: one day to freeze the exchange contract and start the four tracks, two to three days of parallel implementation, then one to two days for serial integration, mock smoke tests, and documentation. Based on the team's “five days remaining” estimate on 2026-10-21, the working code freeze is **2026-10-26 21:00 IST** and A1/A2 go/no-go is **2026-10-24 21:00 IST**. Adjust these if the official deadline differs. [WALLET_VALIDATION.md](WALLET_VALIDATION.md) defines the proof and blocker record; the cutoff does not declare an unavailable test passed.

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

## 22 October independent handoffs

The [snapshot comparison](COMPETITOR_GAP_ANALYSIS.md) changes the next deliverable for each owner, without sharing edit surfaces. These are assignments in this repository; the integrator must send the updated plan to teammates through the team's normal channel.

| Owner | Next self-contained deliverable | Files to edit | Handoff / proof |
|---|---|---|---|
| Person 1 — capture | **Immediate handoff complete** in `77be60a`: four-service synthetic HAR, saved exchange IDs, boundary list, and redaction tests. `9bd766a` adds base64/timing tolerance. Capture v2 now adds skip reasons, coverage, public summaries, local filtering, HMAC redaction, explicit tagging and endpoint guards. Live Web capture remains unobserved. | `apps/bff/src/capture/fixtures/`, capture tests, `CAPTURE.md`, and `redaction.ts` tests. Coordinate before changing `app.ts` or shared types. | [CAPTURE.md](CAPTURE.md) has the fixture, deterministic IDs, test output, sanitized PostgreSQL/API/Socket.IO observations, and boundary list. |
| Person 2 — Web wallet and UX | Build/test the assisted waiting, cancel, timeout, and completion states; then run local Inji Web login → store → present once Person 4 provides the endpoint. Add one browser smoke and keyboard/axe result; optionally render the new public summaries and coverage using the capture contract. | `apps/web/`, new `apps/bff/src/drivers/injiWebAssisted.ts` and its tests, `submission/A1_WEB_EVIDENCE.md`. Do not edit Compose or capture internals. | Browser screenshot/recording, pinned Web/Mimoto versions, run ID and Verify result; if unavailable, exact blocker. |
| Person 3 — protocol correctness | Make an issued, validly signed expired credential and a wrong-holder/key-binding case; isolate one Verify key-resolution probe. Keep nonce replay separate from nonce mismatch; add a canonical/padded `did:jwk` probe, exact scenario references, and maintain the public machine-readable gap snapshot with private triage for security findings. | `apps/mock-issuer/`, `apps/mock-verifier/`, `apps/bff/src/tamper/`, new probe scripts, `GAPS.md`, `submission/gaps.json`, scenario-spec sidecar, `submission/A2_MOBILE_EVIDENCE.md`. Do not edit Compose or UI. | One-variable tests with expected/actual result, version, sanitized report, and mobile-wallet status. |
| Person 4 — local Inji and release | Add a pinned **local Certify + Verify** profile and health checks, then hand Person 2 a usable Mimoto/Web endpoint. Keep existing mock demo green, add the integrator's `pnpm audit:secrets` command to CI, and run a clean-machine rehearsal. | `docker-compose.yml`, `deploy/`, Dockerfiles, `.github/workflows/`, `DEPLOYMENT.md`; request BFF hooks from integrator. | Image tags/digests, configuration provenance, health output, Certify → Reference Wallet → Verify run IDs, install and audit logs. |
| Integrator — this lane | Maintain the shared contract and final evidence, fix Markdown matrix export and immediate Verify submission rejection handling, merge each handoff sequentially, and keep README/acceptance claims accurate. | `apps/bff/src/matrix.ts`, `apps/bff/src/drivers/collab.ts`, their tests, root/shared docs and submission files. Avoid the four owned implementation areas until handoff. | Equal-column Markdown export test, HTTP 400 terminal-result test, reviewed commits preserving authorship, final evidence matrix. |

Person 4 owns service URLs and infrastructure; Person 2 consumes them without changing Compose. Person 3 owns credential faults. Person 1 reads synthetic HAR transiently and persists only sanitized exchanges; it does not read raw driver credentials. The integrator merges the separate A1/A2 evidence files into `WALLET_VALIDATION.md`, avoiding parallel edits to it. If any task needs a shared schema or `app.ts` route, write the proposed contract and let the integrator apply that single change. Continue the no-branch rule and preserve each contributor's author identity through sequential commits or patches.

## Person 1 — protocol capture and safe evidence

**Implementation status:** the immediate synthetic handoff and capture v2 are implemented: saved fixture/IDs, PostgreSQL/API/socket canary checks, counted skipping, coverage, safe public summaries, pre-upload filter, explicit route rules, HMAC correlation and endpoint guards. The canonical proxy has an ADR and disabled unit-tested attribution module, **no forwarder or live stack integration**. See [CAPTURE.md](CAPTURE.md), [SECURITY.md](SECURITY.md), and [the integration contract](CAPTURE_CONTRACT_PROPOSAL.md). Live Inji Web remains unobserved.

**Owns:** new `apps/bff/src/capture/` files, capture-specific tests, and narrowly scoped changes to `apps/bff/src/redaction.ts` and `apps/bff/src/store.ts`. Coordinate any route in `apps/bff/src/app.ts` with the integrator. Do not edit `apps/web/` or wallet drivers.

1. Compare a passive browser-network/HAR import with a transparent proxy. Choose a path that leaves issuer identifiers, audiences, request URIs, redirects, and signed request objects unchanged. A rewriting `/tap/...` proxy does **not** meet this condition.
2. Implement a bounded, allowlisted import/observer path for **synthetic test traffic only**. Parse and redact before persistence or WebSocket emission. Reject oversized, malformed, cross-run, and non-allowlisted traffic. Avoid logging raw error bodies.
3. Map captured Mimoto, Certify, eSignet, and Verify requests to the existing run/step/exchange model. Mark gaps when the capture method cannot see a boundary; do not claim every exchange was captured without evidence.
4. Test redaction for headers, URL query values, JSON/form bodies, nested JWK private fields, and malformed input. Verify the database and API contain only sanitized values.
5. Hand the integrator a sanitized capture example and a short evidence-gap list. Do not wait until the final day to export safe reports from a working sandbox.

**22 October completed handoff:** committed the synthetic four-service fixture and sanitized import-result summary; category-specific redaction, PostgreSQL-row, API and Socket.IO checks pass. Additional tests cover malformed/unfinished/background traffic, endpoint classification, public projection, HMAC scoping, ingress rate/size/content-type handling and local filtering. A reviewed synthetic fixture is scanned by the evidence audit; no raw real-session HAR is committed.

**Current remaining boundary:** Person 2 supplies a real-wallet capture; Person 4 supplies pinned canonical origins, TLS/DNS, metadata/redirect settings and fixed upstreams before any proxy prototype. The local attribution module refuses overlapping claims and does not capture traffic itself. At the 24 October 21:00 IST cutoff, keep the proxy at design stage if that dependency is absent. Contract-drift diff and issue-draft export remain stretch. Person 4 still owns CI wiring; Person 2 owns a dedicated public-view renderer.

**Done when:** the committed synthetic fixture imports without changing protocol URLs or bodies, saved exchanges map only to explicitly recognized run steps, the required negative tests pass, and the handoff includes a boundary list. Live Inji Web capture is a later integration check with Person 2.

## Person 2 — real-wallet journey and assisted UI

**Owns:** `apps/web/src/` and new `apps/bff/src/drivers/injiWebAssisted.ts` plus driver-specific tests. Leave capture internals, mocks, Compose, and shared schemas to their owners. Use a fixture matching the frozen `Exchange` shape until Person 1's capture path is integrated.

1. Add a guided JSON-LD Inji Web journey: start an assisted run, open the wallet, show the verifier request/QR or same-device link, wait for observed issuance and presentation checkpoints, and show a truthful timeout/error state.
2. In the selector, distinguish supported JSON-LD Web presentation, unavailable SD-JWT Web presentation, and the automated Reference Wallet. Never relabel one wallet as another.
3. Keep credentials and login state in Inji Web/Mimoto; the playground stores only redacted exchange evidence and normalized outcome. Add mock-driven UI/driver tests for waiting, completion, cancellation, and timeout.
4. Prepare a manual A1 checklist for a **dedicated persistent test account**. The user said none is available now, so complete the fixture path and record live A1 as blocked until a test account exists.
5. Add a keyboard-only pass, automated accessibility scan (axe or Lighthouse), color-contrast review, and a browser happy-path smoke against mocks. Save annotated final UI screenshots or wireframes for the design submission. Coordinate the browser test with Person 4's CI setup.

**Done when:** the assisted UI and state machine pass fixture tests and can consume Person 1's redacted capture contract. A1 is signed off only after a real Inji wallet stores and presents a JSON-LD VC to Verify; guest download alone does not count.

## Person 3 — protocol correctness and real-wallet evidence

**Owns:** `apps/mock-issuer/`, `apps/mock-verifier/`, `apps/bff/src/tamper/`, new `spikes/wallet-interop-*` scripts/fixtures, `GAPS.md`, and `submission/A2_MOBILE_EVIDENCE.md`. Avoid `apps/web/`, capture files, Compose, and other shared docs.

1. Replace the current “expired” test with a **deliberately issued, validly signed expired credential** from the mock issuer. The present `exp` mutation breaks the issuer signature, so it cannot isolate expiry enforcement. Do the same for wrong-type tests if the goal is to isolate type rather than signature failure.
2. Add an explicit required-disclosure policy to the mock verifier before asserting that a missing disclosure is invalid; an omitted optional claim is not a valid negative test.
3. Probe a pinned Inji mobile wallet build for Certify → Inji Wallet → Verify SD-JWT (A2), then JSON-LD if feasible. Record issuance, holder binding, direct-post shape, verifier result, version/draft, and **sanitized** failure evidence. Do not commit real credentials, OTPs, HAR files, or private keys.
4. Keep the X.509 issuer success separate from trust-chain assurance. If exploring trust, use a configured test trust anchor and make that a separate result, not an inference from the self-signed Collab pass.
5. Maintain [GAPS.md](GAPS.md): pin versions, reduce each observed incompatibility to synthetic steps, check existing upstream issues, and propose a sanitized issue under your own GitHub identity if the behavior is still relevant. Add any filed issue URL to the findings register.

**Done when:** negative cases identify the intended validation failure independently, and `submission/A2_MOBILE_EVIDENCE.md` gives a reproducible pass or an exact external blocker for A2. The integrator updates `WALLET_VALIDATION.md` from this handoff. A Reference Wallet pass cannot close A2.

## Person 4 — packaging, CI, and release checks

**Implementation status:** `pnpm demo:docker` now builds and starts the playground, PostgreSQL, and separate mocks and passed a local cross-container smoke on 2026-10-21. A two-cell synthetic mock matrix passed locally and in [hosted CI](https://github.com/oki-dokii/mosip/actions/runs/39632729703). [DEPLOYMENT.md](DEPLOYMENT.md) records the command and limits. Clean-machine rehearsal and a pinned local Inji profile remain.

**Owns:** `docker-compose.yml`, Dockerfiles, `.dockerignore`, `.github/workflows/`, `deploy/`, and `DEPLOYMENT.md`. Person 2 owns browser test files; Person 4 wires their passing command into CI after handoff. Avoid app source files; request any required health/config hook from the integrator.

1. Package the web, BFF, issuer, verifier, and PostgreSQL. Make `core` and `mocks` profiles work with health checks, dependency readiness, migration deployment, and synthetic-only defaults. Next, make a **pinned local Inji profile the primary live integration target**: Certify + Verify first, then Mimoto + Inji Web for A1. Use official upstream configuration as a referenced dependency, document every local override, and never claim A1 until login, storage, presentation, and verifier result are observed. Official Web setup needs an OIDC client keystore and authentication configuration; containers alone do not remove that blocker.
2. Add CI for install, strict typecheck, unit/contract tests, build, and a Compose-backed mock smoke flow. Add one browser happy-path smoke test if the runner budget supports it; otherwise document and automate the HTTP path first.
3. Verify `docker compose --profile core --profile mocks up --build` opens one URL and runs a mock happy path (A6). Report actual component versions/labels; do not invent versions for Collab services.
4. Write `DEPLOYMENT.md` with startup, shutdown, required ports, synthetic-data setup, and the difference between fixture, mock, and Collab modes. Do not put secrets in images or the repo.
5. On a clean machine, test `corepack enable`, the pinned `pnpm@11.25.0`, install, startup, and smoke. Before public submission, inspect `git ls-files` for `.env`, Postman configurations, private keys, HAR files, and student IDs. Record the actual command output and any exception.

**Done when:** a clean machine can start the playground with Compose, CI passes, the mock smoke run completes, and a reviewer can reproduce it from `DEPLOYMENT.md`.

## Integration sequence and release gate

1. **Parallel development:** all four people work in their owned areas against the frozen types and synthetic fixtures. Person 2 can finish the guided UI before a real wallet account exists; Person 3 can finish negative-case correctness before a mobile device is ready.
2. **Serial integration on `main`:** the integrator applies one workstream at a time, resolves the shared capture/API seam, runs `pnpm test`, `pnpm build`, `pnpm typecheck`, a Compose mock smoke, and checks redaction. No new branches or concurrent pushes to `main`.
3. **External validation:** run A1 only with a dedicated logged-in Inji Web test account; run A2 with a pinned capable Inji mobile wallet. Capture the exact Verify result and keep any unavailable test marked blocked.
4. **Final evidence:** update the compatibility matrix and reports from real run records, reconcile the stale planning language in `SRS.md`/`TRD.md`, record reproducible version labels, make a 3–5 minute demo, and publish the gap write-up. A release is ready when A1, A2, A6 and the redaction checks have evidence, or when the user explicitly accepts named external blockers as the release boundary.

**Integrator-owned release tasks, outside the four code areas:** keep the now-expanded root README current; export sanitized real-run reports and a standalone matrix while Collab works (the first fresh pair is in [submission/evidence](submission/evidence/README.md)); assign a post-integration owner to split `apps/bff/src/drivers/collab.ts` only after parallel edits land; confirm contributor agreement to the new [MPL-2.0 license](LICENSE), finish the transitive/asset notice audit begun in [ATTRIBUTIONS.md](ATTRIBUTIONS.md), and check README, deck, and screenshots against the original-UI requirement. The extra separator cell in the BFF Markdown matrix export is fixed with a format test. A direct-post HTTP 400 now ends the run as an invalid submission without status polling; Person 3 should rerun the live nonce probe and update `GAPS.md` before claiming that observation has changed. Same-device/deep-link presentation is the first optional feature if A1/A2 and A6 are settled with time left; defer mDoc. No optional feature should displace acceptance or release checks.

## Extra research after the mandatory path

- Compare draft-era Collab behavior with final OpenID4VCI/OpenID4VP implementations using one versioned fixture per provider; avoid treating endpoint names as universal.
- Add a credential decoder and lazy-load exchange bodies after the all-Inji and packaging gates. The current UI fetches all redacted exchanges while polling.
- Test a trust-store-backed verifier, issuer certificate chain validation, and revocation independently of signature validity.
- Add side-by-side run comparison and QR-capacity probes only after A1/A2/A6 are reproducible.

These are follow-ups, not prerequisites for the four parallel workstreams.
