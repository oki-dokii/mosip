# Person B / Person 2 — assisted journey, Phase 1

Branch: `codex/person-b-phase-1`. Scope: fixture-driven assisted JSON-LD journey and injectable wallet driver. No live wallet acceptance is claimed.

## Try the fixture journey

Install with `pnpm install --frozen-lockfile`, then run `pnpm dev` and open the Vite web URL (normally `http://localhost:5173`). Select JSON-LD, Inji Certify, Inji Web (Assisted), Inji Verify and No tamper. Click **Start assisted fixture run**.

The fixture runs in browser memory. It does not call the automated BFF run endpoint, write history/matrix results, contact a wallet, or store credentials/login state. The UI explicitly identifies the simulated observations. Click the issuance, separate wallet-storage confirmation, presentation and valid/invalid verifier-result controls in order. Cancel or simulate an observation error at any waiting stage; leaving it waiting for 60 seconds produces a timeout with no verifier verdict. Start again to obtain a fresh isolated fixture run.

Live wallet/offer endpoints are unavailable. The fixture now provides navigable wallet instructions, credential-offer and verifier-request summaries using local anchor links. The panel accepts transient wallet/offer/request action URLs for integration; supported actions are HTTPS links or OpenID4VP links referencing an HTTPS request URI. Missing or unsupported URLs render as unavailable. Opening an action never advances a checkpoint. Fixture completion still requires explicitly simulated observations. Do not enter an account or real credential into this fixture.

## Observation boundary

The web state machine consumes the frozen `Exchange` shape. It checks run ID, step ID, method, HTTP status and source/rule attribution. Synthetic capture fixtures retain Person 1's `browser` actor and `certify`/`verify` service names, `request.source: har_import`, and `certify-credential` / `verify-submit` capture rule IDs. It also accepts explicitly labeled `fixture` driver observations. Duplicate, unrelated, out-of-order and post-terminal observations cannot complete the run.

Issuance endpoint traffic is an observation, not proof of storage. A Mimoto guest download is not accepted as the issuance checkpoint. Storage requires its own explicit confirmation; a presentation observation still leaves the verifier result pending. The normalized verifier result is a separate input. Public decoding is not cryptographic validation.

`InjiWebAssistedDriver` implements the existing `WalletDriver` interface and receives a run ID, existing step IDs, redacted observation source, abort signal and optional timeout through its constructor. The source subscribes and then replays its snapshot, closing the subscribe/replay gap. Storage confirmation must reference the issuance exchange ID. Presentation evidence must follow issuance in exchange sequence. Each wait releases its timer, subscription and abort listener on termination. A timeout/cancellation/source error is terminal for that driver instance; restart with a new instance. The driver retains only issuance ID/sequence and checkpoint flags, and returns safe checkpoint summaries rather than duplicating capture exchanges.

`authorize()` explicitly reports login as unobserved and delegates login to Web/Mimoto; the driver does not exchange tokens or require capture of an invisible login operation.

## Phase 2 integration handoff

- Integrator: register the new driver without falling back to Reference Wallet behavior; supply run/step IDs, a run-scoped observation source and abort signal. The current generic fixture driver remains unchanged.
- Integrator: provide API cancellation and preserve assisted timeout/cancellation reasons in orchestration. Require an actual normalized verifier result rather than the orchestrator's default valid outcome.
- Person 1 + integrator: connect redacted capture events, use the explicit endpoint rules, and retain browser actors. Agree the storage-confirmation provenance. Browser HTTP cannot prove wallet-local persistence.
- Person 4 + integrator: supply configured wallet/offer/verifier request actions and pinned endpoints. Keep transient action links separate from persisted evidence. Supply operational action URLs only when available; the configurable action UI and fixture navigation are implemented. QR generation remains optional because the request-link alternative is supported.
- Person 2: connect the source to the UI, render public-view/coverage data, complete browser/accessibility QA, and prepare the live A1 checklist. Coverage currently arrives in the HAR import response; history/reload retrieval is an integration seam.
- Keep assisted live evidence `unverified` under the existing shared evidence helper unless the integrator supplies a reviewed contract update. Never label it Reference Wallet evidence.

## Validation

New tests: 40 web tests and 15 assisted-driver tests. They cover waiting, valid/invalid completion, cancellation, timeout, errors, separate storage confirmation, source correlation, guest-download exclusion, duplicate/late events, restart/disposal, synchronous replay cleanup, keyboard cancellation, unsupported combinations and preserving the Reference Wallet start route. Web tests use jsdom and Testing Library; no new runtime UI dependency is needed.

Commands: `pnpm test`, `pnpm typecheck`, `pnpm build`, `pnpm audit:secrets`, `git diff --check`. The full suite needs permission to bind local HTTP servers; database-specific capture tests remain conditional on their existing test database configuration. No real-wallet/browser smoke or A1 validation is claimed by these fixture/component tests.

## A1 status

**Blocked: no dedicated persistent Inji Web test account is available.** Live capture, wallet storage and presentation to Inji Verify remain unobserved. Fixture completion, a Reference Wallet result, or guest download alone does not close A1.

## Phase 1 review fixes

Startup readiness now enforces its absolute deadline even if the timeout callback is delayed. A regression test covers late readiness and verifies that a terminal timeout cannot be restarted. Configurable wallet/offer/verifier actions have rendering and URL-validation tests, including absent actions, unsafe schemes, same-device request references, and stage-specific availability. Local fixture links open synthetic instructions and request summaries rather than pointing at a non-operational external placeholder. Action URLs remain outside the journey snapshot and exchange evidence.
