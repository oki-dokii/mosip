# Inji Interoperability Playground

**Find where a verifiable credential journey succeeds or fails.** Choose an issuer, wallet, verifier, and credential format; run an issue → hold → present → verify journey; then inspect its step timeline, sanitized protocol exchanges, sequence view, and downloadable result report.

This is a **test playground**, not a production identity provider or wallet. It uses synthetic identities. Its automated wallet is the project's **Reference Wallet**. A Reference Wallet success does not prove that Inji Web or Inji Wallet mobile stored and presented the credential. The [evidence guide](SCENARIOS_AND_EVIDENCE.md) and [submission checklist](submission/READINESS.md) make that distinction explicit.

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
| Negative cases | Replay expired, bad-signature, wrong-type, missing-disclosure, or replayed-nonce faults where supported. | Some faults still need more isolated tests; see [remaining work](NEXT_STEPS_4_PERSON_PLAN.md). |
| History and exports | Filter runs; download JSON/Markdown reports and JSON/CSV/Markdown matrix exports. | Matrix results are separated by evidence tier. |
| Independent roles | Standalone mock issuer and verifier can be selected for supported SD-JWT tests. | Mock cryptographic checks do not establish production trust. |
| Passive capture | Import bounded, allowlisted synthetic browser HAR traffic after a run. | Gaps remain for server-to-server and native-wallet traffic. |

### Tested combinations

| Issuer | Wallet | Verifier | Format | Recorded status |
|---|---|---|---|---|
| Inji Certify | Reference Wallet | Inji Verify | JSON-LD, SD-JWT | Prior Collab runs returned `valid`; see [Phase 2](PHASE2.md). |
| X.509 mock issuer | Reference Wallet | Inji Verify | SD-JWT | Prior Collab run returned `valid`; the self-signed test certificate does not prove root trust. |
| Inji Certify | Reference Wallet | Standalone mock verifier | SD-JWT | Positive and bad-signature paths recorded. |
| Standalone mock issuer | Reference Wallet | Standalone mock verifier | SD-JWT | Cross-service mock path recorded. |
| Inji Certify | Inji Web or Inji Wallet mobile | Inji Verify | JSON-LD, SD-JWT | **Not yet accepted:** real-wallet store-and-present evidence is missing. |

The detailed recorded outcomes and limitations are in [Phase 3](PHASE3.md). These are prior results, not a fresh live run performed by reading this README. A new mobile app is **not required**; real-wallet validation should use an existing, pinned Inji Wallet build.

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

Open **http://localhost:5174**. The command builds and health-checks the services, then runs two cross-container synthetic SD-JWT cases (valid baseline and corrupted signature) and prints `DEMO PASS` on success. It does **not** launch local Inji services. [DEPLOYMENT.md](DEPLOYMENT.md) has ports, profiles, shutdown, CI details, and the exact evidence limit. Local smoke and [hosted CI](https://github.com/oki-dokii/mosip/actions/runs/39632729703) passed on 2026-10-21; independent clean-machine verification remains open.

## Integration modes

| Mode | Selection | External requirements | Valid claim |
|---|---|---|---|
| Fixture | Default or `PLAYGROUND_DRIVER_MODE=fixture` | None | Product UI and run lifecycle work. |
| Collab with Reference Wallet | `PLAYGROUND_DRIVER_MODE=collab` | Public test environment config and reachable Collab services | Exact live role combination shown in report. |
| Collab with separate mock roles | Collab mode plus `MOCK_ISSUER_BASE_URL` and/or `MOCK_VERIFIER_BASE_URL` | Running local mock services; Certify tests also need its test config | Cross-service mock interoperability for supported SD-JWT cases. |
| Assisted real Inji wallet | Not a completed automated mode | Persistent test wallet, supported version, observed presentation | Pending A1/A2 evidence. |

For live Certify → Reference Wallet → Verify, obtain the **official public test-client environment** described in [Phase 0–1](PHASE0_1.md), keep it outside the repository, and set:

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

Then select **Mock issuer → Reference Wallet → Inji Verify → SD-JWT VC**. The helper generates and removes a temporary self-signed test certificate. This tests protocol compatibility, not certificate-chain trust. For the separate mock-verifier HTTP service, set `MOCK_VERIFIER_BASE_URL=http://127.0.0.1:4102` in Collab mode; [Phase 3](PHASE3.md) details supported combinations.

## Using the playground

1. Open the web app and check its mode badge. Choose a named preset or select issuer, wallet, verifier, format, and optional fault.
2. Start the run. The timeline follows issuance, holding, presentation, and verification; the result compares **expected** with **actual** outcome.
3. Select a step or sequence message to inspect a sanitized exchange. Use history to reopen an earlier run.
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

The [API reference](submission/API_REFERENCE.md) gives request/response details. The [capture guide](CAPTURE.md) explains HAR bounds and blind spots.

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

At the **2026-10-22** checkpoint, **46 automated tests**, strict typechecks, and the production build passed. The tests cover contract fixtures, schemas, BFF behavior, capture/redaction, scenarios, mock services, and the secret-audit script. `pnpm audit:secrets` passed separately; it checks sensitive filenames and documentation/evidence **text** without printing matched values. It does not inspect image or other binary contents and is not a substitute for write-time redaction. The web package has no automated browser test yet; a build pass does not replace an end-to-end UI check. These commands do **not** perform a fresh Collab run. The [test evidence](submission/TEST_EVIDENCE.md) has the breakdown and claim limits.

Fresh synthetic X.509 mock-issuer → Reference Wallet → Collab Verify positive and bad-signature reports were exported on 2026-10-21 at commit `ec1cbbd`; see the [standalone evidence and matrix](submission/evidence/README.md). They are `mock_interop` evidence, not all-Inji wallet evidence. For a live synthetic contract probe, use `pnpm spike:contracts` only after configuring the official public test environment in [Phase 0–1](PHASE0_1.md). The committed fixtures let ordinary tests run offline.

## Security boundaries

- Use **synthetic identities only**. Keep actual `.env` files, OTPs, tokens, private keys, complete credentials, raw HAR files, and student IDs outside Git.
- The BFF redacts exchanges **before storage**. Live credentials and holder keys stay in per-run memory. Socket.IO sends summaries rather than raw bodies.
- HAR import is bounded and allowlisted; it cannot observe every server-to-server or native boundary and does not rewrite signed requests.
- A self-signed X.509 mock issuer acceptance is a compatibility result, not proof of production certificate-chain trust.
- The local API has no user authentication. Do not expose this development server publicly with test credentials configured.

## License and attributions

Project source is provided under [MPL-2.0](LICENSE), consistent with [MOSIP's published licensing](https://github.com/mosip) and the [official Mozilla license text](https://www.mozilla.org/en-US/MPL/2.0/). Direct library credits and the remaining transitive-notice review are in [ATTRIBUTIONS.md](ATTRIBUTIONS.md). The team should confirm all contributors agree to this license before final publication.

## Submission and project documents

The [submission checklist](submission/READINESS.md) maps judging weights and mandatory artifacts to current evidence and open work. It links the [architecture diagram](submission/ARCHITECTURE.md), [test cases/results](submission/TEST_EVIDENCE.md), [fresh synthetic live reports and matrix](submission/evidence/README.md), [API reference](submission/API_REFERENCE.md), and [pitch/video outline](submission/PITCH_AND_DEMO.md). The actual slide deck, 2–5 minute video, private student IDs, cloud links, and final email remain separate tasks; the outline is not a finished deck or recording.

| Read this for… | Document |
|---|---|
| Product goal and acceptance requirements | [PRD](PRD.md), [SRS](SRS.md) |
| Technical and UI design | [TRD](TRD.md), [UI/UX](UIUX.md), [backend](BACKEND.md), [database](DATABASE.md) |
| Code paths and design choices | [Flow map](flow.md), [decision log](decisions.md) |
| Phase evidence | [Phase 0–1](PHASE0_1.md), [Phase 2](PHASE2.md), [Phase 3](PHASE3.md) |
| Independent remaining work | [Four-person plan](NEXT_STEPS_4_PERSON_PLAN.md) |
| Five-day priority order and rival finding probes | [Catch-up plan](CATCH_UP.md) |
| Evidence-based comparison with the attached Paradox-73 snapshot | [Competitor gap analysis](COMPETITOR_GAP_ANALYSIS.md) |
| Container setup and shutdown | [Deployment guide](DEPLOYMENT.md) |
| Scenario provenance | [Scenarios and evidence](SCENARIOS_AND_EVIDENCE.md) |
| Observed interoperability findings | [Gap register](GAPS.md) |
| Proposed capture safety and inspector contract | [Capture contract proposal](CAPTURE_CONTRACT_PROPOSAL.md) |
| A1/A2 proof and cut-off | [Wallet validation](WALLET_VALIDATION.md) |

## Known gaps

| Gate | Needed evidence | Why it matters |
|---|---|---|
| A1: real-wallet JSON-LD | A dedicated logged-in Inji Web or suitable mobile wallet stores and presents to Inji Verify; capture the result. | A Reference Wallet pass does not establish Inji-wallet interoperability. |
| A2: real-wallet SD-JWT | Test a pinned capable Inji Wallet mobile build and record issuance, holder binding, presentation, and Verify outcome. | The tested Inji Web path does not complete SD-JWT presentation. |
| A6: packaging | Playground core + mocks now build, pass health checks, run migrations, and complete a mock smoke through `pnpm demo:docker`. | A separate clean-machine rehearsal and local Inji stack remain open. |
| Capture and browser QA | Assisted-wallet observation without rewriting signed messages, browser smoke, and accessibility review. | Adapter logs cannot prove every browser/native boundary or user-facing behavior. |

Ownership and next steps are in the [four-person plan](NEXT_STEPS_4_PERSON_PLAN.md). Until these gates have evidence, reports should state exactly which implementation was tested instead of claiming a completed all-Inji flow.
