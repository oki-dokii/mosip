# decisions.md

A running log of **meaningful decisions**: what was chosen, why, what was given up. Every AI session or person who changes code must add an entry here in the same change.

Version 0.1 · started 2026-10-17

---

## How to use this file

**Add an entry when you:**
- choose, add, replace or remove a library, framework, service or tool;
- change an API, event, table, column or enum;
- change how a flow works (order of steps, who calls whom);
- accept a shortcut, workaround or known limitation;
- reject an option that someone might reasonably suggest again;
- resolve one of the pending decisions below.

**Do not add entries for:** renames, formatting, small bug fixes with an obvious cause, or copy changes.

**Rules**
1. Newest entries go at the **top of the Log** section; IDs only increase (`D-001`, `D-002`, …).
2. Never delete or rewrite an old entry. If a decision changes, add a new entry and mark the old one `Superseded by D-xxx`.
3. Every entry names the **alternatives considered**, the **reason**, and the **trade-off accepted**. "It is popular" is not a reason.
4. Link the files and requirement IDs affected.
5. Pending items get an ID `P-xxx`; when resolved, add a `D-xxx` entry that references the `P-xxx` and mark the pending item `Resolved by D-xxx`.

### Entry template
```
### D-000 · Short title
- **Date:** YYYY-MM-DD   **Status:** Accepted | Superseded by D-xxx | Reverted
- **Context:** What problem or question forced a choice.
- **Decision:** What we chose.
- **Alternatives considered:** Option A (why not) · Option B (why not)
- **Why this one:** The concrete reasons.
- **Trade-off accepted:** What we gave up or risk we took on.
- **Revisit if:** The condition that should make us reconsider.
- **Affects:** files, modules, requirement IDs (FR-xx), tables.
```

---

## Pending decisions (need facts from a spike)

| ID | Question | Why it matters | Owner | How to resolve | Status |
|---|---|---|---|---|---|
| P-001 | Which Inji Certify issuance flow can be driven headlessly: authorization code via eSignet, or pre-authorized code? | Decides the Certify issuer driver and the Reference Wallet token step | Role A | Live Collab spike | Resolved by D-022: authorization code with PKCE works for both formats; deployed pre-authorized issuance remains broken |
| P-002 | Can Inji Web present credentials through OpenID4VP, or only download/hold? | Decides whether "Inji Web (assisted)" can cover presentation or only issuance | Role A | Spike: try a presentation from Inji Web to Verify; capture traffic | Resolved by D-021: JSON-LD only, with a logged-in persistent wallet |
| P-003 | What exact `vp_token` and submission shape does the current Inji Verify accept? | Reference Wallet must send an acceptable VP | Role A/D | Capture a working wallet submission against the discovered v2/DCQL request | Resolved by D-022: DCQL id-to-array map with no `presentation_submission` |
| P-004 | Which credential formats and proof types does the target Verify and Certify version support end to end? | Fills the compatibility table behind FR-14 | Role A | Test each advertised format with a real wallet and verifier | Resolved by D-022: JSON-LD/Ed25519Signature2020 and SD-JWT/key-binding JWT pass end to end |
| P-005 | Will the playground run against local Inji services or the Collab sandbox for the demo? | Affects base URLs, CORS/ngrok needs and flakiness | Team | Phase 0 decision | Resolved by D-016: Collab first, local fallback/mocks |

---

## Log

### D-027 · Apply tamper faults immediately before presentation
- **Date:** 2026-10-21   **Status:** Accepted
- **Context:** The playground needs visible negative paths without storing live credentials or reusable tokens. A tamper run must also distinguish a correctly rejected credential from an application failure.
- **Decision:** Make tamper kind part of the shared run configuration and persist it with the run. Keep the issued credential in per-run memory, derive a modified presentation copy immediately before holder proof creation, and expect `invalid` for all five current faults. Mark a run passed when actual equals expected, including expected-invalid runs.
- **Alternatives considered:** Persist credentials for later mutation (conflicts with write-time data minimization); alter stored inspector payloads only (does not test the verifier); treat every invalid verifier result as a failed run (cannot express successful negative testing).
- **Why this one:** It exercises the real verifier boundary, preserves the untampered source during a run, and makes expected-versus-actual semantics useful in both fixture and Collab modes.
- **Trade-off accepted:** Replay currently starts as a new full run, missing-disclosure behavior can vary by credential claims, and live negative paths still need a configured Collab smoke run.
- **Revisit if:** Credentials are encrypted for durable replay, scenario-specific expected outcomes are added, or Verify exposes richer invalid/expired classifications.
- **Affects:** `packages/shared`, `apps/bff/src/tamper`, `apps/bff/src/orchestrator.ts`, `apps/web/src/App.tsx`, PostgreSQL `runs.tamper`, FR-60, FR-61.

### D-026 · Make verifier submission status an explicit bounded step
- **Date:** 2026-10-21   **Status:** Accepted
- **Context:** Inji Verify exposes the presentation result separately from request status. Fetching the result immediately after direct post can race slower deployments and makes waiting invisible in the run timeline.
- **Decision:** Add `PRESENT_STATUS` between submission and result. The verifier driver polls `/vp-request/{requestId}/status` until `VP_SUBMITTED`, fails on terminal error states, and times out after a configurable deadline. Each successful poll is returned as an inspectable exchange.
- **Alternatives considered:** Retry only the result endpoint (hides the service's lifecycle); sleep for a fixed duration (slow or racy); poll forever (can strand runs).
- **Why this one:** It follows the deployed Verify contract discovered in Phase 1, gives the timeline an accurate waiting state, and bounds resource use.
- **Trade-off accepted:** Poll exchanges are returned together when the step completes, and active live runs still rely on one BFF process.
- **Revisit if:** Verify adds a push callback, status streaming, or a combined submission-result response.
- **Affects:** `apps/bff/src/drivers`, `apps/bff/src/orchestrator.ts`, `PHASE2.md`, FR-25, FR-44.

### D-025 · Select stateful role drivers per run
- **Date:** 2026-10-21   **Status:** Accepted
- **Context:** The fixture runner and proven Phase 1 Collab script must share one lifecycle without putting protocol logic or live secrets in the HTTP layer or database.
- **Decision:** Define issuer, wallet, and verifier interfaces around a per-run context. Select `fixture` or `collab` explicitly with `PLAYGROUND_DRIVER_MODE`; default to fixtures. Keep live credentials, keys, cookies, proofs, and tokens in the context, return inspectable exchange summaries, and apply central write-time redaction before persistence.
- **Alternatives considered:** Keep protocol-shaped exchanges hard-coded in the orchestrator (cannot execute live flows); run the Phase 1 script as a child process (weak lifecycle and exchange integration); persist complete live protocol bodies (unnecessary exposure of reusable secrets and personal claims).
- **Why this one:** Both modes now exercise the same steps, repository, events, and inspector contract while each role owns its protocol operations and run state remains isolated.
- **Trade-off accepted:** A BFF restart loses an active live run's cryptographic state, and the first Collab adapter supports only Inji Certify + Reference Wallet + Inji Verify.
- **Revisit if:** Active runs must survive restarts, multiple BFF processes execute one run, or assisted browser traffic must be captured.
- **Affects:** `apps/bff/src/drivers`, `apps/bff/src/orchestrator.ts`, `/api/v1/health`, `PHASE2.md`, FR-10, FR-11, FR-25, FR-40..44.

### D-024 · Select PostgreSQL through the run repository boundary
- **Date:** 2026-10-21   **Status:** Accepted
- **Context:** M1 stored runs in process memory, while D-006 requires PostgreSQL for durable history. Developers still need the playground to start without infrastructure for UI work and deterministic tests.
- **Decision:** Put all run, step, and exchange reads and writes behind an asynchronous repository. Select Prisma/PostgreSQL when `DATABASE_URL` exists and use the in-memory implementation otherwise. Report the selected mode from the health endpoint.
- **Alternatives considered:** Require PostgreSQL for every command (slows the local UI loop); silently fall back after a database connection error (can hide lost durability); maintain separate API paths for fixture and database modes (causes drift).
- **Why this one:** Both modes exercise the same lifecycle contract, while configuration remains explicit and PostgreSQL failures are surfaced instead of hidden.
- **Trade-off accepted:** A developer who forgets `DATABASE_URL` gets non-durable runs, so health and startup logs must make the active mode clear.
- **Revisit if:** Tests need database-specific behavior by default or another process must consume the run event stream.
- **Affects:** `apps/bff/src/store.ts`, `apps/bff/prisma`, `docker-compose.yml`, `/api/v1/health`, D-006, FR-80.

### D-023 · Build M1 with a fixture-backed in-memory runner
- **Date:** 2026-10-21   **Status:** Accepted
- **Context:** The first application slice must prove the browser, BFF, run lifecycle, real-time events, inspector, and redaction boundary before database and live-adapter integration increase the debugging surface.
- **Decision:** Implement the M1 walking skeleton with shared Zod contracts, an in-memory run store, and sanitized protocol-shaped exchanges derived from the successful Phase 1 paths. Label the UI and documentation as fixture-backed.
- **Alternatives considered:** Start with Postgres and all live drivers together (slower feedback and harder fault isolation); render a static UI without an API (does not prove the application boundary); call Collab directly from the browser (exposes protocol state and couples the UI to deployments).
- **Why this one:** It creates a usable vertical slice with the same run, step, exchange, and event shapes that persistence and live adapters can retain.
- **Trade-off accepted:** Runs disappear on restart, selectors currently drive simulated paths, and the application itself does not yet repeat the live Phase 1 flow.
- **Revisit if:** The store or exchange contracts cannot support Postgres or a real adapter without breaking the web API.
- **Affects:** `apps/web`, `apps/bff`, `packages/shared`, `PHASE2.md`, FR-01, FR-10, FR-40..44.

### D-022 · Use authorization code for the Collab Reference Wallet baseline
- **Date:** 2026-10-20   **Status:** Accepted
- **Context:** The mock issuer's pre-authorized token is rejected by its credential endpoint, while the official Collab eSignet client can obtain correctly configured authorization-code tokens. The deployed Verify v2 endpoint also uses DCQL response shapes newer than the checked-out documentation.
- **Decision:** Use authorization code with PKCE and the issuer nonce endpoint for the Phase 1 Reference Wallet baseline. Present JSON-LD with an Ed25519 linked-data holder proof expressed as `did:key`, and present SD-JWT with an EdDSA key-binding JWT. For DCQL direct post, map each credential-query id to an array and omit `presentation_submission`.
- **Alternatives considered:** Treat the broken pre-authorized path as a blocker; bypass holder proof; use the guest Inji Web download as if it were persistent wallet storage.
- **Why this one:** It proves real, holder-bound issuance and verification for both mandatory formats against the deployed services without hiding the separate Collab defect or overstating Inji Web support.
- **Trade-off accepted:** The automation uses a Reference Wallet and the official public Collab client configuration. It does not prove an all-Inji SD-JWT presentation because current Inji Web does not implement it.
- **Revisit if:** Collab fixes pre-authorized issuance, Verify accepts `did:jwk` presentation proofs, or Inji Web adds SD-JWT presentation.
- **Affects:** `spikes/collab-reference-wallet.mjs`, Phase 1 fixtures, `PHASE0_1.md`, future issuer/wallet/verifier adapters.

### D-021 · Use mobile or Reference Wallet for the Phase 1 presentation leg
- **Date:** 2026-10-20   **Status:** Accepted
- **Context:** The deployed Inji Web route recognized a real Verify JSON-LD authorization request, then required Google login. The guest-issued credential was downloaded rather than retained, and guest presentation was unavailable. Upstream also marks SD-JWT presentation as pending.
- **Decision:** Count Inji Web as the proven JSON-LD issuer/download client. Use a logged-in persistent Inji Web wallet only when a dedicated test account is available; otherwise use Inji Wallet mobile or the clearly labeled Reference Wallet for presentation.
- **Alternatives considered:** Use a personal Google account for the test (mixes personal state into a reproducible spike); claim guest download proves presentation (it does not); wait for SD-JWT support in Inji Web (does not meet the current delivery window).
- **Why this one:** It matches the deployed behavior and upstream capability boundary while preserving a path to complete both required formats.
- **Trade-off accepted:** The first complete presentation may not be all-Inji Web, and an all-Inji SD-JWT run requires the mobile wallet.
- **Revisit if:** A dedicated Inji Web test account is provided or upstream enables guest and SD-JWT presentation.
- **Affects:** P-002, P-003, P-004, D-002, D-016, `PHASE0_1.md`, wallet driver selection.

### D-020 · Use the official Collab test identity for assisted Inji Web issuance
- **Date:** 2026-10-20   **Status:** Accepted
- **Context:** Every issuer exposed to Inji Web uses the authorization-code grant, so a real wallet issuance test requires an eSignet login.
- **Decision:** Use the public test identity and mock OTP documented in Certify's official Docker quickstart to test the Farmer JSON-LD flow in guest mode. Save only a redacted success screenshot and sanitized contract facts.
- **Alternatives considered:** Ask for a private test identity (unnecessary); treat catalog discovery as issuance success (does not prove the flow); wait for the broken pre-authorized Collab endpoint (tests a different integration path).
- **Why this one:** It is the upstream-supported test path and completed a real `FarmerCredential_VCDM2.0` download without user or production data.
- **Trade-off accepted:** The assisted browser step is not yet automated, and a downloaded credential does not establish OpenID4VP presentation support.
- **Revisit if:** A dedicated automated Collab identity or stable pre-authorized deployment becomes available.
- **Affects:** P-001, P-002, P-004, `PHASE0_1.md`, `spikes/fixtures/*`.

### D-019 · Treat Collab pre-authorized credential rejection as an environment blocker
- **Date:** 2026-10-20   **Status:** Accepted
- **Context:** Collab's pre-authorized endpoint returns access tokens for both advertised `dc+sd-jwt` and `ldp_vc` configurations that its own credential endpoint rejects with HTTP 401.
- **Decision:** Record the failure as a sanitized contract fixture, keep the adapter standards-compliant, and do not weaken token or proof validation to work around Collab. Continue the independently testable Verify lifecycle while a configured Certify deployment or Collab fix is obtained.
- **Alternatives considered:** Forge missing token claims or bypass validation (would not test the deployed service and requires signing authority); classify the generated proof as faulty (the request is rejected before its proof can be evaluated); stop all Phase 1 work (unnecessary because Verify and Mimoto contracts remain testable).
- **Why this one:** The returned token has blank issuer/audience, omits nonce/client ID, and uses a key absent from the authorization server JWKS. Those facts conflict with current Certify's production validation contract.
- **Trade-off accepted:** A successful real credential and VP remain outside the automated Collab spike until the environment is fixed or test identity access is supplied.
- **Revisit if:** Collab deploys the current pre-authorized implementation, publishes the correct signing key/configuration, or a team-controlled Certify instance is available.
- **Affects:** P-001, P-003, P-004, `PHASE0_1.md`, `spikes/collab-contract-spike.mjs`, `spikes/fixtures/*`.

### D-018 · Discover and pin deployed protocol contracts
- **Date:** 2026-10-20   **Status:** Accepted
- **Context:** The repository planned against legacy Certify discovery and Inji Verify presentation-definition endpoints, while the Collab deployment has moved.
- **Decision:** Read issuer metadata and service OpenAPI at startup/spike time, save sanitized versioned fixtures, and select a version-specific adapter. The current Collab baseline is Certify root discovery plus separate nonce endpoint, and Verify v2 with DCQL.
- **Alternatives considered:** Hard-code paths from repository documents (already returned 404); support only the latest contract without identifying it (makes regressions hard to explain).
- **Why this one:** The playground must report what was actually tested and survive differences between releases.
- **Trade-off accepted:** Adapter and fixture maintenance across versions.
- **Revisit if:** Inji publishes and maintains one stable compatibility contract across deployed releases.
- **Affects:** P-001, P-003, P-004, `PHASE0_1.md`, `spikes/collab-contract-spike.mjs`, `drivers/*`.

### D-017 · Capture protocol exchanges at adapters before adding a transparent Tap
- **Date:** 2026-10-20   **Status:** Accepted
- **Context:** Rewriting traffic through `/tap/...` can alter signed issuer identifiers, audiences, DIDs, request URIs, redirect URIs, and QR payloads.
- **Decision:** Record outbound and inbound protocol data at issuer, wallet, and verifier adapters. Add proxy capture only for a client and flow proven to tolerate it without rewriting signed values.
- **Alternatives considered:** Force every request through a rewriting proxy (complete view but can invalidate messages); packet capture (hard to associate with runs and encrypted traffic).
- **Why this one:** It gives the inspector trustworthy payloads without changing the protocol under test.
- **Trade-off accepted:** Browser/mobile internals may be represented only by boundary messages unless the client exposes diagnostics.
- **Revisit if:** A no-rewrite observability proxy can preserve every signed URL and payload for the pinned releases.
- **Affects:** D-003, FR-40..44, `TRD.md`, `BACKEND.md`.

### D-016 · Phase 0 targets Collab, Inji Web, and a one-week MVP
- **Date:** 2026-10-20   **Status:** Accepted
- **Context:** Implementation needed a concrete target before the integration spikes.
- **Decision:** Use Collab first, local mocks for the development loop, and prioritize Inji Web as the real wallet. Use Inji Wallet mobile if the pinned Web/Verify combination cannot finish presentation. Optimize for the mandatory one-week team MVP.
- **Alternatives considered:** Full local stack first (high setup cost); Reference Wallet as the only wallet (does not prove an all-Inji combination); broad P1/P2 scope from day one (risks the required flow).
- **Why this one:** It reaches a real integration quickly while preserving a credible all-Inji target.
- **Trade-off accepted:** The first demo depends on Collab availability and may require a mobile fallback.
- **Revisit if:** Collab is unstable or the target deployment must be fully offline.
- **Affects:** P-002, P-005, PRD milestones, environments, demo path.

### D-015 · Test data only, secrets masked before storage
- **Date:** 2026-10-17   **Status:** Accepted
- **Context:** The Tap records full HTTP traffic, which would include access tokens and pre-authorized codes.
- **Decision:** Redact secrets in the Tap before anything is written to the database or sent to the UI. Use synthetic identities only. Show a "Test data only" badge.
- **Alternatives considered:** Store raw and mask on read (a leak risk if the database is shared or exported); store nothing sensitive and skip capture (loses the inspector's value).
- **Why this one:** Masking at write time means no later code path can leak what was never stored.
- **Trade-off accepted:** Replays cannot reuse recorded tokens, so a replay re-runs the token step. Some debugging detail is lost.
- **Revisit if:** A debugging need requires raw values; then add an explicit, local-only debug flag, never default.
- **Affects:** `tap/redaction.ts`, `exchanges.redactions`, NFR-05, NFR-06, FR-43.

### D-014 · Own UX, do not copy the external VC playground
- **Date:** 2026-10-17   **Status:** Accepted
- **Context:** The problem statement links an external VC playground "for reference only" and asks not to replicate it as-is.
- **Decision:** Design our own layout, naming and visuals, centred on the three-column selector, Tap-based inspector and expected-vs-actual reports.
- **Alternatives considered:** Mirror its layout for familiarity (violates the instruction).
- **Why this one:** Follows the rules and lets us add differentiators (tamper expectations, matrix, history).
- **Trade-off accepted:** Slightly more design effort.
- **Revisit if:** Organizers clarify that closer similarity is fine.
- **Affects:** `UIUX.md`, all web components.

### D-013 · Docker Compose profiles (`core`, `inji`, `mocks`, `full`)
- **Date:** 2026-10-17   **Status:** Accepted
- **Context:** The Inji services are heavy, but the playground itself and mocks are light.
- **Decision:** Split the Compose file into profiles so people can run only what they need, and so Collab-sandbox mode works without local Inji services.
- **Alternatives considered:** One monolithic compose file (slow for UI work); separate repos for each piece (harder to run in one command).
- **Why this one:** Faster inner loop for frontend and BFF work; one-command full bundle still available.
- **Trade-off accepted:** More Compose configuration to maintain.
- **Revisit if:** Profiles cause confusion for new users; then add a wrapper script.
- **Affects:** `docker-compose.yml`, FR-01, FR-04, NFR-01, NFR-12.

### D-012 · mso_mdoc deferred to a late, mock-mode stretch
- **Date:** 2026-10-17   **Status:** Accepted
- **Context:** The problem statement requires two formats minimum and lists mDoc as good-to-have; mDoc needs CBOR/COSE handling and device-engagement concepts.
- **Decision:** Ship W3C VC JSON-LD and SD-JWT VC first. Treat mDoc as P2 using Certify's mock mDoc support only if time remains.
- **Alternatives considered:** mDoc as one of the two mandatory formats (higher risk); skip entirely (loses a good-to-have).
- **Why this one:** Meets the mandatory requirement with less risk.
- **Trade-off accepted:** No mDoc in the main demo.
- **Revisit if:** All P0 and P1 items are stable before Day 6.
- **Affects:** FR-12, F-19, `wallet/formats/mdoc.ts`.

### D-011 · Zod schemas shared between web and BFF
- **Date:** 2026-10-17   **Status:** Accepted
- **Context:** The same request/response shapes are used on both sides.
- **Decision:** Define schemas once in `packages/shared` with Zod and derive TypeScript types from them.
- **Alternatives considered:** OpenAPI codegen (heavier tooling); duplicated hand-written types (drift).
- **Why this one:** One source of truth, runtime validation, small setup cost.
- **Trade-off accepted:** No auto-generated public API docs unless we add them later.
- **Revisit if:** External consumers need an OpenAPI spec.
- **Affects:** `packages/shared`, all routes, `lib/api.ts`.

### D-010 · pnpm workspaces monorepo
- **Date:** 2026-10-17   **Status:** Accepted
- **Context:** Web, BFF, two mock services and shared types must evolve together within a week.
- **Decision:** One repository with pnpm workspaces: `apps/web`, `apps/bff`, `apps/mock-issuer`, `apps/mock-verifier`, `packages/shared`.
- **Alternatives considered:** Separate repos (slow cross-cutting changes); npm workspaces (slower installs, weaker hoisting control).
- **Why this one:** Fast installs and clear package boundaries; one place for CI.
- **Trade-off accepted:** Team must install pnpm.
- **Revisit if:** Tooling friction appears in Docker builds.
- **Affects:** repo root, Dockerfiles, CI.

### D-009 · Sequence diagrams generated from recorded exchanges with mermaid.js
- **Date:** 2026-10-17   **Status:** Accepted
- **Context:** FR-70/71 need an animated OpenID4VP/VCI sequence view.
- **Decision:** Generate Mermaid `sequenceDiagram` text from stored exchanges and render it with mermaid.js; implement animation by revealing messages progressively.
- **Alternatives considered:** Hand-drawn static diagrams (not tied to real runs); custom SVG/WebSocket timeline (more work); D3 (overkill).
- **Why this one:** The diagram is always true to the run and the problem statement names Mermaid.
- **Trade-off accepted:** Mermaid has limited animation control, so playback is a reveal effect, not true motion.
- **Revisit if:** Playback feels clumsy; switch to a custom SVG renderer.
- **Affects:** `sequence/mermaid.ts`, `SequenceDiagram` component, FR-70, FR-71.

### D-008 · `jose` and `@sd-jwt/*` for credential crypto
- **Date:** 2026-10-17   **Status:** Accepted
- **Context:** The Reference Wallet and mocks must sign proofs, parse JWTs and handle SD-JWT disclosures.
- **Decision:** Use `jose` for JWS/JWT and `@sd-jwt/sd-jwt-vc` / `@sd-jwt/core` for SD-JWT. Do not hand-roll signing.
- **Alternatives considered:** `jsonwebtoken` (less complete JOSE support, weaker key handling); writing our own (security risk, time sink).
- **Why this one:** Maintained libraries covering the algorithms we need, with TypeScript types.
- **Trade-off accepted:** Extra dependencies; SD-JWT library versions may lag the latest draft.
- **Revisit if:** A required algorithm or draft feature is unsupported.
- **Affects:** `wallet/formats/sdjwt.ts`, `apps/mock-issuer`, `apps/mock-verifier`.

### D-007 · Socket.IO for live run events
- **Date:** 2026-10-17   **Status:** Accepted
- **Context:** The inspector must update live (FR-44).
- **Decision:** Use Socket.IO with one room per run; send small events, fetch bodies by REST on demand.
- **Alternatives considered:** Server-sent events (one-way, simpler but no rooms or client-to-server join); raw WebSocket (manual reconnect and rooms).
- **Why this one:** Built-in rooms and reconnection; the team already knows it.
- **Trade-off accepted:** Heavier client library than SSE.
- **Revisit if:** Deployment behind a proxy makes WebSocket upgrades difficult.
- **Affects:** `ws/gateway.ts`, `lib/socket.ts`, FR-44.

### D-006 · PostgreSQL + Prisma; no Redis in v1
- **Date:** 2026-10-17   **Status:** Accepted
- **Context:** We need durable run history, filters, and a "latest per combination" view. Live events are per run and short-lived.
- **Decision:** PostgreSQL 16 with Prisma. Use an in-process event emitter for live events. Do not add Redis.
- **Alternatives considered:** SQLite (weaker for concurrent runs and Docker volumes); Redis for pub/sub and caching (an extra service with no v1 need).
- **Why this one:** Postgres gives views, JSONB and indexes for the dashboard; Prisma gives migrations and types; fewer moving parts.
- **Trade-off accepted:** Live events do not survive a BFF restart or scale across multiple BFF instances.
- **Revisit if:** We need more than one BFF instance or background job queues.
- **Affects:** `DATABASE.md`, `db/client.ts`, `ws/gateway.ts`.

### D-005 · React + Vite SPA with Tailwind (not Next.js)
- **Date:** 2026-10-17   **Status:** Accepted
- **Context:** The problem statement allows Next.js or Vite. The app is a tool behind a BFF, with no SEO or server rendering need.
- **Decision:** React 18 + TypeScript + Vite + Tailwind, TanStack Query for data.
- **Alternatives considered:** Next.js (adds server-rendering concepts and a second server with no benefit here).
- **Why this one:** Simpler build and faster dev server; one backend only.
- **Trade-off accepted:** No server-side rendering; a public landing page, if wanted, would be a separate static page.
- **Revisit if:** We need server-rendered shareable report pages.
- **Affects:** `apps/web`.

### D-004 · Node.js + Express + TypeScript for the BFF
- **Date:** 2026-10-17   **Status:** Accepted (chosen by the team in the planning quiz)
- **Context:** The BFF proxies and normalises calls to Certify, Mimoto and Verify.
- **Decision:** Node 20, Express 4, TypeScript strict.
- **Alternatives considered:** Spring Boot (matches Inji's own stack, but slower to build and no shared types with the frontend); FastAPI (familiar to the team but not in the suggested stack and no shared types).
- **Why this one:** Shared TypeScript types with the frontend, easy WebSockets, mature proxy middleware, fast iteration inside one week.
- **Trade-off accepted:** Less alignment with Inji's Java codebase if the work is later contributed back.
- **Revisit if:** The organizers require a Java BFF.
- **Affects:** `apps/bff`, TRD §2.

### D-003 · A logging reverse proxy ("Tap") records all protocol traffic
- **Date:** 2026-10-17   **Status:** Accepted
- **Context:** The inspector must show raw payloads for any caller: the BFF, the Reference Wallet, or Inji Web running in a browser.
- **Decision:** All base URLs given to clients point at `/tap/<runId>/<service>/…`. The Tap forwards and records every exchange.
- **Alternatives considered:** Each driver logs its own calls (misses Inji Web traffic); a packet sniffer or mitmproxy (hard to set up, hard to tie to a run); modifying Inji services to emit logs (out of scope).
- **Why this one:** One capture point for every actor, tied to a run id, with redaction in one place.
- **Trade-off accepted:** Extra network hop; redirects and absolute URLs need rewriting; clients that hard-code service URLs bypass the Tap.
- **Revisit if:** Inji Web cannot be pointed at the Tap (see P-002, R-5).
- **Affects:** `tap/*`, FR-40..44, NFR-02.

### D-002 · Wallet role = Reference Wallet (headless) plus Inji Web (assisted); no mobile app
- **Date:** 2026-10-17   **Status:** Accepted
- **Context:** The team cannot build a mobile app. The problem statement allows Inji Web instead of Inji Wallet mobile. We have not confirmed Inji Web can present via OpenID4VP (P-002).
- **Decision:** Implement a headless Reference Wallet inside the BFF that speaks OpenID4VCI and OpenID4VP, and offer "Inji Web (assisted)" where the user acts in the browser and the Tap observes.
- **Alternatives considered:** Only Inji Web (blocked if it cannot present); only a mobile wallet (out of reach); a browser-based custom wallet UI (more UI work than a headless one, with no extra proof value).
- **Why this one:** Guarantees an end-to-end flow even if Inji Web is limited, and makes automated, tamper and CI runs possible.
- **Trade-off accepted:** The Reference Wallet is our code, not Inji's, so a pass proves Certify and Verify interoperate with a standards-based wallet, not that Inji Wallet does. The UI must label it clearly.
- **Revisit if:** P-002 shows Inji Web fully covers both issuance and presentation.
- **Affects:** `wallet/*`, `drivers/wallet/*`, FR-11, FR-25, FR-32.

### D-001 · Build problem statement #02 (Interoperability Playground)
- **Date:** 2026-10-17   **Status:** Accepted
- **Context:** Four problem statements were offered (#01 conformance harness, #02 playground, #03 eSignet Native SSO, #04 face liveness).
- **Decision:** Build #02.
- **Alternatives considered:** #01 (safer, little UI, less full-stack); #03 (needs Go, DPoP internals and native mobile apps); #04 (needs computer vision and Android work).
- **Why this one:** Best fit to the team's strengths (React/TypeScript, Node, Docker, Postgres), no mobile requirement for the mandatory scope, and the most visible demo.
- **Trade-off accepted:** Higher complexity and a heavy stack setup; risk that the Inji services are hard to connect (mitigated by Day-1 spikes and the Collab fallback).
- **Revisit if:** The Day 1–2 spikes show no credential can be obtained from Certify; then reconsider #01.
- **Affects:** everything.
