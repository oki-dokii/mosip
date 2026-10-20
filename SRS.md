# Software Requirements Specification (SRS)

**Project:** Inji Interoperability Playground
**Document version:** 0.1 (design phase)
**Date:** 2026-10-17
**Related:** PRD.md (why), TRD.md (how), BACKEND.md, DATABASE.md, UIUX.md, decisions.md, flow.md

Priority tags used throughout: **P0** = mandatory in the problem statement, **P1** = stretch features the team chose, **P2** = extra features from our own research (do only if P0 and P1 are stable).

Items marked **⚠ OPEN** depend on facts we have not yet confirmed against the real Inji services. They are tracked in `decisions.md` under "Pending decisions".

---

## 1. Introduction

### 1.1 Purpose
Define what the Inji Interoperability Playground must do. It is a single web app where a user picks an issuer, a wallet and a verifier, runs a live issue → hold → present → verify flow, and sees every protocol exchange, credential format, signature scheme and failure mode.

### 1.2 Scope
In scope:
- Orchestrating Inji Certify (issuer), Inji Web / Mimoto (wallet side) and Inji Verify (verifier).
- A built-in headless **Reference Wallet** and optional **mock external issuer and verifier** to test beyond Inji-to-Inji.
- Capturing and displaying all protocol traffic.
- Per-run pass/fail reports, a compatibility matrix and run history.

Out of scope:
- Building or modifying a mobile wallet app (the team will not build mobile).
- Changing the source code of Inji Certify, Inji Verify, Mimoto or Inji Web.
- Production-grade multi-tenant hosting, user accounts, or handling real personal data.
- Copying the UX of the external reference VC playground as-is (explicit constraint in the problem statement).

### 1.3 Definitions
| Term | Meaning |
|---|---|
| VC / VP | Verifiable Credential / Verifiable Presentation |
| OpenID4VCI | OpenID for Verifiable Credential Issuance (Inji Certify targets draft 13) |
| OpenID4VP | OpenID for Verifiable Presentations (Inji Verify targets draft 21) |
| BFF | Backend-for-frontend; here the playground's Node/Express orchestrator |
| Tap | Logging reverse proxy inside the BFF that records every HTTP exchange between actors |
| Reference Wallet | Headless wallet implemented inside the BFF that speaks OpenID4VCI and OpenID4VP |
| Run | One execution of an issue → present → verify scenario with a fixed combination |
| Scenario | A saved run configuration (combination, format, flow, optional tamper) |
| Tamper | Deliberate corruption of a VC/VP to test a verifier's negative path |
| Interop matrix | Table of issuer × wallet × verifier × format combinations and their latest outcome |

### 1.4 References
Problem statement "02 Inji | Build an Interoperability Playground for Verifiable Credentials"; Inji docs (Certify, Verify, Web, Wallet); `@mosip/react-inji-verify-sdk`; `mosip/inji-config`.

---

## 2. Overall description

### 2.1 Product perspective
The playground sits **in front of** existing Inji services. It does not replace them. All traffic between actors flows through the Tap so it can be recorded.

```
 Browser (React SPA)
        │  REST + WebSocket
        ▼
 Playground BFF (Node/Express) ── Postgres
   │  Orchestrator   │  Tap proxy
   │                 ├──► Inji Certify  (issuer)
   │  Reference      ├──► Mimoto ◄── Inji Web (wallet UI)
   │  Wallet         ├──► Inji Verify service (verifier)
   │                 └──► Mock issuer / Mock verifier (external-style)
```

### 2.2 Users
| User | Need |
|---|---|
| Integrator / new developer | See and trust how Inji issues, holds and verifies credentials |
| Inji core-team engineer | Find and reproduce interoperability gaps; track regressions across releases |
| Hackathon judge | Understand the value from one demo run in a few minutes |

### 2.3 Operating environment
- Runs locally through Docker Compose on Linux, macOS or Windows (WSL2).
- Browser: current Chrome and Firefox.
- Optionally pointed at the MOSIP Collab sandbox instead of local services.
- No mobile device is required for any P0 or P1 requirement.

### 2.4 Constraints
- Protocol versions and API generations differ by deployed release. The playground discovers and records capabilities, selects a version-specific adapter, and reports the exact contract tested. The 2026-10-20 Collab baseline exposes Certify's current OpenID4VCI metadata and Inji Verify's v2/DCQL OpenID4VP API.
- Local Inji Web gives CORS errors against a remote Mimoto, so calls go through a proxy.
- Test data only. No real personal data is stored.

### 2.5 Assumptions and dependencies
- Docker images for Certify, Verify, Mimoto and Inji Web can be run locally or the Collab sandbox is reachable.
- **⚠ OPEN (P-001):** which Certify issuance flow is usable headlessly (authorization code via eSignet vs pre-authorized code).
- **⚠ OPEN (P-002):** whether Inji Web can present credentials via OpenID4VP. If not, the Reference Wallet performs presentation.
- **⚠ OPEN (P-003):** exact `vp_token` shape Inji Verify accepts.

---

## 3. Functional requirements

### 3.1 Stack setup and health
| ID | Requirement | Pri |
|---|---|---|
| FR-01 | One command (`docker compose up`) starts the playground, its database and the Inji services it needs. | P0 |
| FR-02 | A health view shows up/down status and version of each connected service. | P0 |
| FR-03 | Service base URLs are configurable through environment variables so the same build can target local services or the Collab sandbox. | P0 |
| FR-04 | Compose profiles allow starting only `core`, `core + mocks`, or `full`. | P1 |

### 3.2 Role selection
| ID | Requirement | Pri |
|---|---|---|
| FR-10 | A 3-column "Issuer → Wallet → Verifier" selector lets the user pick an implementation per role. | P0 |
| FR-11 | Available implementations: issuer {Inji Certify, Mock issuer}; wallet {Inji Web (assisted), Reference Wallet}; verifier {Inji Verify, Mock verifier}. | P0 (Inji options) / P1 (mock options) |
| FR-12 | The user selects the credential format: W3C VC JSON-LD, SD-JWT VC; mso_mdoc is added later. | P0 (two formats) / P2 (mdoc) |
| FR-13 | The UI always labels the format, proof type and algorithm in use for the current run. | P0 |
| FR-14 | Combinations the selected services cannot support are disabled with a reason (for example, a format the chosen issuer does not offer). | P0 |
| FR-15 | The user can choose the presentation flow: cross-device (QR) or same-device (deep link). | P0 (cross-device) / P2 (same-device) |
| FR-16 | Scenario presets provide one-click configurations (for example "Happy path: SD-JWT, all Inji"). | P2 |

### 3.3 Issue a credential
| ID | Requirement | Pri |
|---|---|---|
| FR-20 | The user starts an issuance run; the BFF triggers the selected issuer to create a credential offer. | P0 |
| FR-21 | The UI shows the credential offer (URI and QR) and the issuer metadata used. | P0 |
| FR-22 | The UI shows the token exchange step (request, response, token type) with secrets masked. | P0 |
| FR-23 | The UI shows the issued credential, decoded, with format, issuer, subject, validity and proof details. | P0 |
| FR-24 | The issued credential is stored with the run so it can be presented, replayed or tampered with. | P0 |
| FR-25 | With "Inji Web (assisted)", the user performs the wallet steps in Inji Web and the run advances when the Tap observes the issuance calls. | P0 ⚠ P-001 |

### 3.4 Present and verify
| ID | Requirement | Pri |
|---|---|---|
| FR-30 | The BFF creates a presentation request at the selected verifier (for Inji Verify, `POST /vp-request`). | P0 |
| FR-31 | The UI displays the authorization request as a QR code and a deep link. | P0 |
| FR-32 | The selected wallet submits the credential as a presentation to the verifier. | P0 ⚠ P-002, P-003 |
| FR-33 | The BFF tracks request status until submitted, expired or failed. | P0 |
| FR-34 | The UI shows the result as one of **Valid**, **Invalid**, **Valid but expired**, or **Error**, with the verifier's per-credential detail. | P0 |
| FR-35 | Same-device flow through a deep link and the Digital Credentials API. | P2 |

### 3.5 Protocol inspector
| ID | Requirement | Pri |
|---|---|---|
| FR-40 | Every HTTP exchange between actors in a run is captured by the Tap and stored. | P0 |
| FR-41 | The inspector shows a step timeline; selecting a step shows its raw request and response. | P0 |
| FR-42 | The inspector shows at least: authorization request, credential offer, token exchange, credential response, `presentation_definition`, `vp_token`, verification result JSON. | P0 |
| FR-43 | Sensitive values (access tokens, pre-authorized codes, private keys) are masked in the UI and not stored in clear text. | P0 |
| FR-44 | Events appear in the UI live as the run progresses (WebSocket). | P0 |
| FR-45 | A credential decoder panel decodes JWT, SD-JWT (including disclosures) and JSON-LD proofs for inspection. | P2 |

### 3.6 Reporting
| ID | Requirement | Pri |
|---|---|---|
| FR-50 | Each run produces a pass/fail report with issuer, wallet, verifier, format, proof type, outcome and error detail. | P0 |
| FR-51 | A report can be exported as Markdown and JSON. | P0 |
| FR-52 | An interop matrix aggregates the latest outcome per combination and can be exported as Markdown, JSON or CSV. | P0 (view) / P1 (export) |

### 3.7 Replay and tamper
| ID | Requirement | Pri |
|---|---|---|
| FR-60 | From a finished run, the user can replay presentation with a deliberate fault: expired credential, bad signature, wrong credential type, missing disclosure, replayed nonce. | P1 |
| FR-61 | Each tamper option declares an **expected outcome**; the report shows expected vs actual and marks a mismatch as a finding. | P1 |

### 3.8 Sequence visualisation
| ID | Requirement | Pri |
|---|---|---|
| FR-70 | A Mermaid sequence diagram is generated from the recorded exchanges of a run. | P1 |
| FR-71 | The diagram can be played step by step (animated reveal), synchronised with the timeline. | P1 |

### 3.9 History and regression tracking
| ID | Requirement | Pri |
|---|---|---|
| FR-80 | A history dashboard lists past runs. | P1 |
| FR-81 | History can be filtered by module version, format, outcome, and role implementations. | P1 |
| FR-82 | Two runs can be compared side by side (config, steps, outcome, payload differences). | P2 |
| FR-83 | Each run records the versions of every service it touched. | P1 |

### 3.10 Non-Inji (cross-ecosystem) mocks
| ID | Requirement | Pri |
|---|---|---|
| FR-90 | A mock external OpenID4VCI issuer (not Inji code) can issue SD-JWT VC to the Reference Wallet. | P1 |
| FR-91 | A mock external OpenID4VP verifier can verify credentials issued by Inji Certify. | P1 |

### 3.11 Gap reporting and probes
| ID | Requirement | Pri |
|---|---|---|
| FR-100 | From a failed or mismatched run, the user can generate a GitHub issue draft (title, steps, versions, payload excerpts) for the relevant Inji repository. | P2 |
| FR-110 | A QR capacity probe measures payload size against QR version limits and reports whether a presentation request or credential fits. | P2 |
| FR-111 | A clock-skew and expiry-boundary scenario set tests verifier behaviour near `exp` and `nbf`. | P2 |

---

## 4. Non-functional requirements

| ID | Requirement | Measure |
|---|---|---|
| NFR-01 | Cold start with prebuilt images | Playground usable within 10 minutes of `docker compose up` on a typical laptop |
| NFR-02 | Live inspector latency | Exchange appears in UI within 500 ms of being recorded |
| NFR-03 | Run isolation | Two concurrent runs never mix exchanges or credentials |
| NFR-04 | Determinism | A run records all inputs needed to re-run it (configuration, versions, tamper settings) |
| NFR-05 | Secrets handling | No access token, pre-authorized code or private key stored or logged in clear text |
| NFR-06 | Data safety | Only synthetic test identities are used; no real PII |
| NFR-07 | Input safety | Custom endpoint URLs are validated and blocked from reaching internal addresses not on the allow list (SSRF guard) |
| NFR-08 | Usability | A first-time user completes a full happy-path run in under 3 minutes using a preset |
| NFR-09 | Accessibility | Keyboard-operable controls, visible focus, colour not the only status signal, contrast at WCAG AA |
| NFR-10 | Maintainability | TypeScript strict mode; shared request/response schemas between frontend and BFF; unit tests on tamper, redaction, report and sequence generation |
| NFR-11 | Observability | Structured JSON logs with run id on every line |
| NFR-12 | Portability | Works on the Collab sandbox by changing environment variables only |

---

## 5. External interface requirements

### 5.1 Interfaces to Inji services (as understood today)
| Service | Interface used | Notes |
|---|---|---|
| Inji Verify service | Current Collab: `POST /v2/vp-request`, `GET /v2/vp-request/{requestId}`, `POST /v2/vp-submission/direct-post`, status and result endpoints | Current requests use DCQL and signed request objects. A legacy adapter may retain presentation-definition support for older releases. |
| Inji Certify | Root issuer metadata plus pre-authorized data, offer retrieval, token, nonce and credential endpoints | Pre-authorized offer/token flow confirmed on Collab; final credential request currently returns HTTP 401 and remains under investigation. |
| Mimoto | Current Collab: `GET /v1/mimoto/issuers`, `/issuers/{id}`, `/issuers/{id}/configuration` | Backend for Inji Web and Inji Wallet. The old `/credentialTypes` route is absent from the deployed contract. |
| Inji Web | Browser UI that uses Mimoto | Local run needs Node 18 and a proxy to avoid CORS. |

### 5.2 Playground APIs
Defined in BACKEND.md.

### 5.3 User interface
Defined in UIUX.md.

---

## 6. Data requirements
Defined in DATABASE.md. Summary: runs, run steps, exchanges, credentials, verification results, service versions, scenarios, issue drafts, QR probes; plus a view for the latest outcome per combination.

---

## 7. Acceptance criteria (high level)

| # | Criterion | Covers |
|---|---|---|
| A1 | With Inji Certify, a real Inji wallet (Web or mobile), Inji Verify and JSON-LD selected, a user completes issue → present → verify and sees a Valid result. | FR-10..FR-34 |
| A2 | A second all-Inji run completes with SD-JWT using an Inji wallet version that supports SD-JWT presentation. A Reference Wallet result is reported separately and cannot satisfy this criterion. | FR-12, FR-34 |
| A3 | The inspector shows the offer, token exchange, credential response, `presentation_definition`, `vp_token` and result JSON for the run. | FR-40..FR-42 |
| A4 | A report exists for the run with all required fields and can be downloaded as Markdown and JSON. | FR-50, FR-51 |
| A5 | No secret appears in the UI or database in clear text. | FR-43, NFR-05 |
| A6 | `docker compose up` followed by opening one URL reaches the playground. | FR-01, NFR-01 |
| A7 | (P1) A tampered presentation is rejected by Inji Verify and the report shows expected vs actual. | FR-60, FR-61 |
| A8 | (P1) A run with the mock external issuer completes against Inji Verify, or the failure is recorded with a clear error detail. | FR-90, FR-91 |

---

## 8. Traceability
Each FR is mapped to a feature in PRD.md (`F-xx`), a module in TRD.md and an endpoint or table in BACKEND.md / DATABASE.md. When an FR changes, update those documents and add an entry to `decisions.md`.
