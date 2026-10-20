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
| P-001 | Which Inji Certify issuance flow can be driven headlessly: authorization code via eSignet, or pre-authorized code? | Decides the Certify issuer driver and the Reference Wallet token step | Role A | Live Collab spike | Partly resolved by D-018: pre-authorized offer/token/nonce work; credential call returns 401 |
| P-002 | Can Inji Web present credentials through OpenID4VP, or only download/hold? | Decides whether "Inji Web (assisted)" can cover presentation or only issuance | Role A | Spike: try a presentation from Inji Web to Verify; capture traffic | Open |
| P-003 | What exact `vp_token` and submission shape does the current Inji Verify accept? | Reference Wallet must send an acceptable VP | Role A/D | Capture a working Inji wallet submission against the discovered v2/DCQL request | Partly resolved by D-018: request and response URI known; submission body remains open |
| P-004 | Which credential formats and proof types does the target Verify and Certify version support end to end? | Fills the compatibility table behind FR-14 | Role A | Test each advertised format with a real wallet and verifier | Partly resolved by D-018: advertised capabilities captured; end-to-end results open |
| P-005 | Will the playground run against local Inji services or the Collab sandbox for the demo? | Affects base URLs, CORS/ngrok needs and flakiness | Team | Phase 0 decision | Resolved by D-016: Collab first, local fallback/mocks |

---

## Log

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
