# Inji Interoperability Playground


[![Playground CI](https://github.com/oki-dokii/mosip/actions/workflows/ci.yml/badge.svg)](https://github.com/oki-dokii/mosip/actions/workflows/ci.yml)

**Find where a verifiable credential journey succeeds or fails.** Choose an issuer, wallet, verifier, and credential format; run an issue → hold → present → verify journey; then inspect its step timeline, sanitized protocol exchanges, sequence view, and downloadable result report.


[Open the hosted read-only demo](https://oki-dokii.github.io/mosip/) · [One-page judge guide](submission/JUDGE_GUIDE.md) · [One-page claims and evidence](submission/CLAIMS_AND_EVIDENCE.md) · [Local wallet labs](docs/LOCAL_WALLET_LABS.md) · [November deck](submission/pitch/Playground-2026-11-01.pdf) · [Captioned video](submission/pitch/Playground-2026-11-01.mp4)

## 30-second judge path

The tour takes about 30 seconds after startup; the first install/container build can take several minutes. With the pinned dependencies and Docker installed:

```bash
pnpm run doctor
pnpm install --frozen-lockfile
pnpm demo:docker
```

Open **http://localhost:5174**. Start a mock run, inspect the timeline/exchanges,
then open the compatibility matrix and findings. This six-case demo uses synthetic
mock services; the labelled historical Web archive is a recorded result, not a new
wallet run. For the real local wallet journey, use the
[managed capture runbook](docs/PERSON1_LOCAL_CAPTURE_HANDOFF.md).

Open **Parties** to browse registered endpoints and their evidence, or **QR and capabilities** to compare raw and PixelPass payloads. [Register an issuer in five minutes](docs/PARTIES.md). [Aggregate report](submission/AGGREGATE_REPORT.md) · [Browse 77 indexed observations](submission/protocol-matrix.json) or [reproduce the four walt.id interoperability cells](deploy/waltid/README.md).

[Current results and limits](submission/evidence/2026-10-26-aggregate-interop.md) ·
[Machine-readable compatibility matrix](submission/evidence/2026-10-26-aggregate-matrix.json) ·
[Current team assignment](docs/FINAL_FOUR_PERSON_EXECUTION_PLAN.md)


This is a **test playground**, not a production identity provider or wallet. It uses synthetic identities. Its automated wallet is the project's **Reference Wallet**. A Reference Wallet success does not prove that Inji Web or Inji Wallet mobile stored and presented the credential. The [evidence guide](docs/SCENARIOS_AND_EVIDENCE.md) and [submission checklist](submission/READINESS.md) make that distinction explicit.

The web app includes an evidence-linked gap explorer. Every live claim is tied to a dated run, deployment profile and its observed limits.
For a single-developer finish, use the [ordered remaining-work handoff](docs/archive/SINGLE_OWNER_HANDOFF.md).
The [editable pitch deck](submission/pitch/archive/Interoperability_Playground_Pitch.pptx) summarizes the problem, prototype and recorded evidence for review. A [2:07 silent demo draft](submission/pitch/VIDEO_README.md) is ready for voiceover and final review.

For the implemented official local-Certify mobile setup, use `pnpm mobile:inji` and follow [the mobile runbook](deploy/MOBILE_INJI.md). Its official-Certify → Reference Wallet → Collab Verify control passed; it does not establish phone acceptance.

Latest wallet checkpoints: **A1 has a fresh managed Inji Web JSON-LD run** with Mimoto issuance/presentation observations, reload-backed storage confirmation, request-URI correlation and an independent Inji Verify `valid` result; [the evidence bundle](submission/evidence/person2-managed-a1-2026-10-25/README.md) records its blind spots and awaits final team review. **A2 passed for the recorded hybrid profile** on 23 October—official local Certify → actual Android Inji Wallet → Collab Verify, with user-confirmed reopen persistence and a correlated `valid` result. See [the mobile evidence and limitations](submission/evidence/person3-a2-mobile-2026-10-23/README.md). Installed-binary attestation and running Collab releases remain unverified.

## Contents

- [Problem and solution](#problem-and-solution)
- [Current capabilities](#current-capabilities)
- [Architecture and flows](#architecture-and-flows)
- [Quick start](#quick-start)
- [Integration modes](#integration-modes)
- [Using the playground](#using-the-playground)
- [API and repository map](#api-and-repository-map)
- [Tests and evidence](#tests-and-evidence)
- [Security boundaries](#security-boundaries)
- [License and attributions](#license-and-attributions)
- [Submission and project documents](#submission-and-project-documents)
- [Known gaps](#known-gaps)

## Problem and solution

An issuer may create a credential successfully while a wallet rejects its offer or a verifier rejects its presentation. The incompatibility might be a protocol draft, credential format, proof, issuer trust rule, nonce, or redirect. A final “invalid” result alone does not identify the failing boundary.

The playground records named steps and **redacted** evidence at each observed boundary. A tester can compare implementations, change one variable with a scenario preset, replay a negative case, and export a report with the observed result and its evidence tier.

```mermaid
flowchart LR
  I[Issuer<br/>creates credential] -->|Offer and issuance| W[Wallet<br/>receives and holds]
  W -->|Presentation response| V[Verifier<br/>checks proof and policy]
  V -->|Valid / Invalid / Error| R[Playground result]
  I -. sanitized exchanges .-> E[(Run evidence)]
  W -. sanitized exchanges .-> E
  V -. sanitized exchanges .-> E
  E --> T[Timeline, inspector,<br/>sequence, report, matrix]
```

The question for every run is **which exact combination was tested, what happened, and what does the evidence prove?** The result keeps the expected and actual outcomes, format, proof type, version labels, and provenance together.

## Current capabilities

| Capability | Implemented behavior | Limit |
|---|---|---|
| Scenario and role selection | Choose an issuer, wallet, verifier, format, and optional fault; named presets change one variable at a time. | Unsupported live combinations are disabled or rejected. |
| Timeline and updates | The BFF runs ten named steps; Socket.IO sends progress summaries with polling recovery. | Results reflect the selected driver mode. |
| Inspector and sequence | Inspect sanitized exchanges, play a sequence, and export Mermaid source. | Some browser/native boundaries cannot be observed. |
| Negative cases | Replay expired, bad-signature, wrong-type, missing-disclosure, or replayed-nonce faults where supported. | Controlled mock SD-JWT faults require exact rejection reasons; genuine replay and holder faults are covered separately by the Person 3 harness. |
| History and exports | Filter runs; download JSON/Markdown reports and JSON/CSV/Markdown matrix exports. | Matrix results are separated by evidence tier. |
| Independent roles | Standalone mock issuer and verifier can be selected for supported SD-JWT tests. | Mock cryptographic checks do not establish production trust. |
| Capture | Bounded synthetic browser HAR, hosted metadata bridge, and opt-in canonical local server-hop forwarding. | Browser and Mimoto server hops have separate actors/coverage; native traffic and unrecorded hops remain unobserved. |

### Tested combinations

| Issuer | Wallet | Verifier | Format | Recorded status |
|---|---|---|---|---|
| Inji Certify | Reference Wallet | Inji Verify | JSON-LD, SD-JWT | Prior Collab runs returned `valid`; see [Phase 2](docs/PHASE2.md). |
| X.509 mock issuer | Reference Wallet | Inji Verify | SD-JWT | Prior Collab run returned `valid`; the self-signed test certificate does not prove root trust. |
| Inji Certify | Reference Wallet | Standalone mock verifier | SD-JWT | Positive and bad-signature paths recorded. |
| Standalone mock issuer | Reference Wallet | Standalone mock verifier | SD-JWT | Cross-service mock path recorded. |
| Official local Inji Certify | Actual Inji Wallet Android | Collab Inji Verify | SD-JWT | **Observed A2 pass:** stored card, user-confirmed reopen persistence, same-wallet share and correlated valid proof result; [evidence/limits](submission/evidence/person3-a2-mobile-2026-10-23/README.md). |
| Inji Certify | Inji Web (assisted) | Inji Verify | JSON-LD | **Managed A1 technical chain recorded:** same-run Mimoto transport, reload-backed storage confirmation, correlated presentation and independent Verify `valid`; [evidence and limits](submission/evidence/person2-managed-a1-2026-10-25/README.md). Final team review pending. |
| Official local Certify 0.14.0 | Official local Inji Web 0.17.0 / Mimoto 0.22.0 | Official local Verify 0.18.2 | JSON-LD | **Managed local pass:** one BFF run links captured server hops, exact-card reload, same-wallet presentation and independent Verify Valid with both proofs true. Synthetic authorization and explicit DID adapter; [evidence and boundaries](submission/evidence/2026-10-26-managed-local-jsonld/README.md). |

The detailed recorded outcomes and limitations are in [Phase 3](docs/PHASE3.md). These are prior results, not a fresh live run performed by reading this README. A new mobile app is **not required**; real-wallet validation should use an existing, pinned Inji Wallet build.

## Architecture and flows

### Components

```mermaid
flowchart TB
  U[Tester] --> WEB[React / Vite web app]
  WEB -->|REST commands and details| API[Express BFF]
  API -->|Socket.IO summaries| WEB
  API --> O[Run orchestrator]
  O --> D[Issuer / wallet / verifier drivers]
  D --> F[Deterministic fixtures]
  D --> C[Collab adapters]
  C --> CERT[Inji Certify and eSignet]
  C --> REF[Reference Wallet]
  C --> VERIFY[Inji Verify]
  C --> MI[Standalone mock issuer]
  C --> MV[Standalone mock verifier]
  O --> RED[Redact before persistence]
  RED --> STORE[(Memory or PostgreSQL)]
  STORE --> API
  HAR[Synthetic browser HAR] --> IMP[Validate, allowlist, redact]
  IMP --> STORE
```

The browser starts a run through the BFF. The orchestrator selects role drivers, executes each step, records safe exchanges, and pushes small progress events. The browser fetches stored details for the timeline, inspector, sequence, and reports. `PLAYGROUND_DRIVER_MODE=fixture` uses deterministic responses; `collab` selects live adapters. See the [architecture note](submission/ARCHITECTURE.md) for component boundaries.

### Automated Reference Wallet journey

```mermaid
sequenceDiagram
  autonumber
  actor Tester
  participant Web as Playground web
  participant BFF as BFF / orchestrator
  participant Issuer as Issuer
  participant Wallet as Reference Wallet
  participant Verifier as Verifier
  Tester->>Web: Choose scenario and start
  Web->>BFF: POST /api/v1/runs
  BFF-->>Web: 202 + runId
  BFF->>Issuer: Discover metadata and request credential
  Issuer-->>BFF: Offer, token, credential exchanges
  BFF->>Wallet: Hold credential in run context
  BFF->>Verifier: Create presentation request
  Verifier-->>BFF: Request URI / challenge
  BFF->>Wallet: Prepare bound presentation
  Wallet->>Verifier: Submit vp_token
  BFF->>Verifier: Poll status and fetch result
  Verifier-->>BFF: Valid / Invalid / Error
  BFF-->>Web: Progress summaries over Socket.IO
  Web->>BFF: GET steps, sanitized exchanges, report
  BFF-->>Web: Evidence and final result
```

This sequence depicts the **automated Reference Wallet path**. Real Inji Web/mobile handoffs require separately observed wallet evidence; this diagram is not proof that those paths passed.

### Run state and provenance

```mermaid
stateDiagram-v2
  [*] --> Pending: POST /runs
  Pending --> Running: orchestrator starts
  Running --> Passed: actual matches expected
  Running --> Failed: result mismatch
  Running --> Errored: adapter or upstream error
  Passed --> [*]
  Failed --> [*]
  Errored --> [*]
```

| Evidence tier | A pass establishes | It cannot establish |
|---|---|---|
| `fixture` | UI, orchestration, schemas, and simulated exchanges work. | Live interoperability. |
| `mock_interop` | A live Reference Wallet flow used at least one external mock role. | An all-Inji flow or production trust. |
| `reference_wallet` | Live Inji services completed a flow through the automated Reference Wallet. | Inji Web/mobile storage and presentation. |
| `unverified` | The record lacks sufficient provenance for the other tiers. | A verified real-wallet acceptance pass. |

## Quick start

Prerequisites: **Node.js 20+**, **pnpm 11** (the repo pins `pnpm@11.25.0`), and Docker with Compose for the container bundle. OpenSSL is needed only for the ephemeral X.509 mock-issuer helper.

From the repository root:

```bash
pnpm install
pnpm dev
```

Open **http://localhost:5173**. The BFF serves **http://localhost:4000/api/v1/health**. Vite proxies `/api` and `/socket.io` to the BFF. Fixture mode is the default, and storage is in memory unless `DATABASE_URL` is set. This is the shortest path for trying the UI; its protocol results are **simulated**. `pnpm dev` also starts the standalone mock-service processes on local ports 4101 and 4102, though fixture mode does not need them.

Check the active driver and storage modes:

```bash
curl http://localhost:4000/api/v1/health
```

For persistent run history while running the app processes on the host, start only the PostgreSQL service:

```bash
docker compose up -d postgres
export DATABASE_URL='postgresql://playground:playground@127.0.0.1:55433/playground?schema=public'
pnpm db:deploy
pnpm dev
```

The health response reports `storage: "postgres"` when this connection is active. Without it, runs disappear on BFF restart. Compose binds PostgreSQL to host port 55433 by default to avoid an existing local PostgreSQL on 5432; set `PLAYGROUND_POSTGRES_PORT` to override it.

For the **one-command container demo** with the web app, BFF, PostgreSQL, and separate mock issuer/verifier:

```bash
pnpm demo:docker
```

Open **http://localhost:5174**. The command builds and health-checks the services, then runs six cross-container synthetic SD-JWT presets (valid control, corrupted signature, signed expiry, signed wrong type, missing required disclosure and nonce mismatch) and prints `DEMO PASS` on success. It does **not** launch local Inji services. [DEPLOYMENT.md](docs/DEPLOYMENT.md) has ports, profiles, shutdown, CI details, and the exact evidence limit. [Hosted CI run 28](https://github.com/oki-dokii/mosip/actions/runs/39902817583) passed the six-case Docker matrix and browser checks; an independent-machine rehearsal remains open.
The same command passed on this Mac on 25 October with all six scenarios; [the dated local record](submission/evidence/2026-10-25-local-demo.md) lists their run IDs. Independent-machine installation remains a final review check.

For a separate **official local Inji service control**, run `pnpm demo:inji`. It starts pinned Inji Certify and Inji Verify on loopback, issues a synthetic SD-JWT, and uses a non-Inji reference holder to present it. On 25 October it printed `LOCAL INJI DEMO PASS` with Verify `valid` and true credential/holder proof checks. With the services running, `pnpm probe:inji` runs seven fresh-request cases; the pinned Verify release accepted wrong-nonce, wrong-audience, exact-replay and invalid-descriptor-path presentations, so this probe currently exits nonzero by design. It does not start Mimoto or Inji Web and does not create a playground BFF run. See the [exact setup, versions and limits](deploy/INJI_LOCAL.md) and [sanitized evidence](submission/evidence/2026-10-25-local-inji-extended-matrix.json).

For the **connected local JSON-LD wallet flow**, run `pnpm demo:web-jsonld`. It stages official Certify 0.14.0, Web 0.17.0, Mimoto 0.22.0 and Verify 0.18.2, then drives synthetic login → issuance → exact-card reload → consent → presentation → Verify Valid. It uses a synthetic authorization fixture and local HTTPS DID adapter, described in the [runbook](deploy/INJI_WEB_LOCAL.md); product binaries are unchanged. The [sanitized same-wallet evidence](submission/evidence/2026-10-26-local-web-jsonld/README.md) records both credential and holder proof checks true. This direct browser harness does not create a BFF run or replace hosted A1 evidence. A JDK with `keytool` and Playwright Chromium are required.

The original **login-only wallet shell** remains available through `pnpm stage:web-local` and `pnpm check:web-local`. Its [historical browser result](submission/evidence/2026-10-25-local-inji-web-wallet.json) and [screenshot](submission/evidence/2026-10-25-local-inji-web-home.png) intentionally show an empty issuer list.

The same Compose demo also lists the **25 October managed Inji Web A1 run** in Run history. Open run `3dc6895d` or use **Explore managed run in playground** in the real-wallet evidence panel to inspect its ten steps, seven sanitized exchanges, sequence and report. This is a **read-only projection of a committed historical export**, with the original run ID and timestamps. Opening it does not contact Collab or repeat issuance or presentation. Its original export incorrectly labelled the wallet version as `reference-wallet/0.1.0`; the demo projection displays `unreported` and leaves the source export intact. Set `PLAYGROUND_ARCHIVED_A1=false` to omit this record.

## Integration modes

| Mode | Selection | External requirements | Valid claim |
|---|---|---|---|
| Fixture | Default or `PLAYGROUND_DRIVER_MODE=fixture` | None | Product UI and run lifecycle work. |
| Collab with Reference Wallet | `PLAYGROUND_DRIVER_MODE=collab` | Public test environment config and reachable Collab services | Exact live role combination shown in report. |
| Collab with separate mock roles | Collab mode plus `MOCK_ISSUER_BASE_URL` and/or `MOCK_VERIFIER_BASE_URL` | Running local mock services; Certify tests also need its test config | Cross-service mock interoperability for supported SD-JWT cases. |
| Assisted real Inji Web | Backend-assisted live run with a signed-in wallet and metadata-only capture bridge | Persistent test wallet, configured public endpoints and local bridge token | One managed A1 JSON-LD run is recorded for the Land Registry profile; browser capture omits Mimoto server-side calls. A2 has separate Android evidence. |
| Local official Inji service control | `pnpm demo:inji` | Docker and first-setup access to tagged official images/config | Certify → reference holder → Verify returned `valid` on loopback for one synthetic SD-JWT; no real wallet or BFF run is claimed. |

For live Certify → Reference Wallet → Verify, obtain the **official public test-client environment** described in [Phase 0–1](docs/PHASE0_1.md), keep it outside the repository, and set:

```bash
export PLAYGROUND_DRIVER_MODE=collab
export OFFICIAL_POSTMAN_ENV_PATH='/absolute/path/to/inji-certify-with-mock-identity.postman_environment.json'
export MOCK_OTP='<official-public-mock-otp>'
pnpm dev
```

Never commit the OTP or environment file. [.env.example](.env.example) lists optional endpoint overrides, poll timing, and version labels. Collab version labels default to `unreported` unless you provide actual deployment versions.

For a local external mock issuer with an ephemeral X.509 certificate:

```bash
pnpm dev:x509-mock
```

Then select **Mock issuer → Reference Wallet → Inji Verify → SD-JWT VC**. The helper generates and removes a temporary self-signed test certificate. This tests protocol compatibility, not certificate-chain trust. For the separate mock-verifier HTTP service, set `MOCK_VERIFIER_BASE_URL=http://127.0.0.1:4102` in Collab mode; [Phase 3](docs/PHASE3.md) details supported combinations.

## Using the playground

1. Open the web app and check its mode badge. Choose a named preset or select issuer, wallet, verifier, format, and optional fault.
2. Start the run. The timeline follows issuance, holding, presentation, and verification; the result compares **expected** with **actual** outcome.
3. Select a step or sequence message to inspect a sanitized exchange. Use history to reopen an earlier run. The historical A1 row is explicitly marked **Archived real-wallet evidence** and cannot be modified by capture import.
4. Replay a completed run with a fault, or compare combinations in the matrix. Download the report or matrix for a reviewable record.
5. For a live claim, record the environment, exact versions, timestamp, verifier response, and evidence tier. A fixture pass remains fixture evidence.

Example baseline API request:

```bash
curl -X POST http://localhost:4000/api/v1/runs \
  -H 'Content-Type: application/json' \
  -d '{"issuer":"inji_certify","wallet":"reference_wallet","verifier":"inji_verify","format":"vc_sd_jwt","flow":"cross_device","tamper":null,"scenarioId":null}'
```

The BFF returns `202` and a `runId`. Poll `GET /api/v1/runs/{runId}` or follow progress in the web app. For a named preset, copy its exact configuration from `GET /api/v1/scenarios`.

## API and repository map

The local API base is `http://localhost:4000/api/v1`. The BFF has **no user-authentication layer**; use synthetic data and a trusted development network.

| Area | Endpoints | Purpose |
|---|---|---|
| Discovery | `GET /health`, `/meta/implementations`, `/scenarios` | Active mode, storage, roles, formats, presets. |
| Runs | `POST /runs`, `GET /runs`, `GET /runs/:id` | Start, list/filter, and inspect runs. |
| Evidence | `GET /runs/:id/steps`, `/exchanges`, `/sequence`, `/report` | Timeline, redacted exchanges, Mermaid source, report. |
| Experimentation | `POST /runs/:id/replay`, `/capture/har` | Linked replay and bounded synthetic HAR import. |
| Compatibility | `GET /matrix`, `/matrix/export` | Latest outcomes by combination and evidence tier. |
| Progress | Socket.IO namespace `/runs` | Small events; fetch bodies via REST. |

The [API reference](submission/API_REFERENCE.md) gives request/response details. The [capture guide](docs/CAPTURE.md) explains HAR bounds and blind spots.

```text
apps/
  web/             React interface
  bff/             API, orchestrator, drivers, redaction, run store
  mock-issuer/     Standalone synthetic SD-JWT issuer
  mock-verifier/   Standalone synthetic presentation verifier
packages/shared/  Shared schemas and types
spikes/           Contract probes and sanitized fixtures
submission/       Judge-facing readiness, architecture, API, tests, pitch outline
```

## Tests and evidence

Run these checks from the repository root:

```bash
pnpm test
pnpm typecheck
pnpm build
pnpm audit:secrets
```

On the **2026-10-23** `main` checkpoint (`b0f132d`), **339 ordinary automated tests passed** and three opt-in PostgreSQL tests skipped. All three opt-in checks later passed against a disposable local PostgreSQL 16 database, for **342 passing tests with none skipped**. Typecheck, production build, secret audit, three Chromium browser checks and the six-case Docker matrix passed in [CI run 28](https://github.com/oki-dokii/mosip/actions/runs/39902817583). The browser checks cover the assisted fixture, independent mock/capture journey, keyboard navigation and scoped axe accessibility. A [fresh checkout rehearsal](submission/CLEAN_CHECKOUT_REHEARSAL.md) repeated install, tests and build on this Mac; independent-machine setup remains open. These checks do **not** perform a fresh Collab or real Inji-wallet run. The [test evidence](submission/TEST_EVIDENCE.md) and [aggregate report](submission/evidence/2026-10-26-aggregate-interop.md) give the evidence boundaries.

For the browser checks, install Chromium once with `pnpm --filter @playground/web exec playwright install chromium`, then run `pnpm --filter @playground/web test:browser`. The Playwright configuration starts its own local mocks, in-memory BFF and Vite. Override `PLAYGROUND_BROWSER_ISSUER_PORT`, `PLAYGROUND_BROWSER_VERIFIER_PORT`, `PLAYGROUND_BROWSER_BFF_PORT` and `PLAYGROUND_BROWSER_WEB_PORT` if the default ports are occupied. Tests use synthetic data only.

Fresh synthetic X.509 mock-issuer → Reference Wallet → Collab Verify positive and bad-signature reports were exported on 2026-10-21 at commit `ec1cbbd`; see the [standalone evidence and matrix](submission/evidence/README.md). They are `mock_interop` evidence, not all-Inji wallet evidence. For a live synthetic contract probe, use `pnpm spike:contracts` only after configuring the official public test environment in [Phase 0–1](docs/PHASE0_1.md). The committed fixtures let ordinary tests run offline.

## Security boundaries

- Use **synthetic identities only**. Keep actual `.env` files, OTPs, tokens, private keys, complete credentials, raw HAR files, and student IDs outside Git.
- The BFF redacts exchanges **before storage**. Live credentials and holder keys stay in per-run memory. Socket.IO sends summaries rather than raw bodies.
- HAR import is bounded and allowlisted; it cannot observe every server-to-server or native boundary and does not rewrite signed requests.
- A self-signed X.509 mock issuer acceptance is a compatibility result, not proof of production certificate-chain trust.
- The local API has no user authentication. Do not expose this development server publicly with test credentials configured.

## License and attributions

Project source is provided under [MPL-2.0](LICENSE), consistent with [MOSIP's published licensing](https://github.com/mosip) and the [official Mozilla license text](https://www.mozilla.org/en-US/MPL/2.0/). Direct library credits and the remaining transitive-notice review are in [ATTRIBUTIONS.md](docs/ATTRIBUTIONS.md). The team should confirm all contributors agree to this license before final publication.

## Submission and project documents

The [submission checklist](submission/READINESS.md) maps judging weights and mandatory artifacts to current evidence and open work. It links the [architecture diagram](submission/ARCHITECTURE.md), [test cases/results](submission/TEST_EVIDENCE.md), [fresh synthetic live reports and matrix](submission/evidence/README.md), [API reference](submission/API_REFERENCE.md), and [pitch/video outline](submission/PITCH_AND_DEMO.md). The actual slide deck, 2–5 minute video, private student IDs, cloud links, and final email remain separate tasks; the outline is not a finished deck or recording.

| Read this for… | Document |
|---|---|
| Product goal and acceptance requirements | [PRD](docs/PRD.md), [SRS](docs/SRS.md) |
| Technical and UI design | [TRD](docs/TRD.md), [UI/UX](docs/UIUX.md), [backend](docs/BACKEND.md), [database](docs/DATABASE.md) |
| Code paths and design choices | [Flow map](docs/flow.md), [decision log](docs/decisions.md) |
| Phase evidence | [Phase 0–1](docs/PHASE0_1.md), [Phase 2](docs/PHASE2.md), [Phase 3](docs/PHASE3.md) |
| Independent remaining work | [Four-person plan](docs/archive/NEXT_STEPS_4_PERSON_PLAN.md) |
| Container setup and shutdown | [Deployment guide](docs/DEPLOYMENT.md) |
| Scenario provenance | [Scenarios and evidence](docs/SCENARIOS_AND_EVIDENCE.md) |
| Observed interoperability findings | [Gap register](docs/GAPS.md) |
| Proposed capture safety and inspector contract | [Capture contract proposal](docs/CAPTURE_CONTRACT_PROPOSAL.md) |
| A1/A2 proof and cut-off | [Wallet validation](docs/WALLET_VALIDATION.md) |

## Known gaps

| Gate | Needed evidence | Why it matters |
|---|---|---|
| A1: real-wallet JSON-LD | A fresh managed Inji Web run records the observed Mimoto checkpoints, storage confirmation and matching Verify `valid` result; [final team review is pending](submission/evidence/person2-managed-a1-2026-10-25/README.md). | Browser capture cannot see Mimoto's downstream server calls; deployed releases remain unreported. |
| A2: real-wallet SD-JWT | Recorded functional pass with actual Android wallet, reopened storage and valid credential/holder proof result. | Hybrid profile only; installed-binary attestation and Collab release remain unverified. |
| A6: packaging | Playground core + mocks pass `pnpm demo:docker`; official Certify/Verify reference-holder control passes `pnpm demo:inji`; connected local JSON-LD wallet flow passes `pnpm demo:web-jsonld` with the documented synthetic authorization/DID adapters. | Independent-machine rehearsal and offline context packaging remain open. The local browser harness is separate from a managed BFF run. |
| Capture and browser QA | Live assisted-wallet observation without rewriting signed messages. | Three synthetic browser/axe checks pass; they cannot prove the real wallet's browser/native boundaries. |

Ownership and next steps are in the [single-owner handoff](docs/archive/SINGLE_OWNER_HANDOFF.md). Reports should state the exact implementation, profile and observed boundaries; the A1 and A2 records do not establish every format or a complete local Inji deployment.
