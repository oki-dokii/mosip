# Person B / Person 2 — Phase 2 implementation and validation

Branch: `codex/person-b-phase-1`. Updated 23 October 2026 after the user authorized backend integration beyond the original Person 2 file boundary.

## Implemented

- Safe public summaries, capture metadata, projection totals, unknown-format explanations and sanitized JSON details.
- Backend-assisted start/status/cancel and observation APIs with a run-scoped instance of `InjiWebAssistedDriver`. Fixture runs use the same backend lifecycle and repository as live runs; fixture issuance/presentation injection is rejected for live sessions. Storage confirmation references the issuance exchange and records fixture versus wallet-confirmation provenance.
- Active-run HAR ingress is permitted only for managed assisted sessions. Existing bounds, origin allowlists, tagging and pre-persistence redaction remain in force. Standard active runs still reject imports. Capture snapshots feed the waiting driver through a subscription; no HTTP endpoint is treated as proof of storage.
- Orchestrator cancellation and per-step deadlines preserve `ASSISTED_CANCELLED` / `ASSISTED_TIMEOUT` / observation-error reasons, clear timers/listeners, and abort live HTTP calls. Explicit verifier outcome is mandatory; the old default-valid behavior cannot complete an assisted run. Driver and user-confirmation state retain no credential/login material.
- Authoritative GET coverage supports reload/history. UI exposes backend fixture/live controls, polls run status, shows server deadline, allows cancellation and keeps fixture and unverified-wallet evidence distinct.
- `/api/v1/matrix/cells` supplies the supported positive-control grid with explicit `not_tested`, timestamps and evidence tiers. The browser renders it without inventing combinations. Existing matrix exports remain compatible.
- Keyboard and scoped axe/contrast checks, independent-mock browser smoke, connected backend-assisted completion/cancellation smoke, screenshots, and the dedicated-account A1 checklist.

## API contract

- `GET /api/v1/assisted/capabilities`: fixture and configured-live availability.
- `POST /api/v1/assisted/runs`: `{config, mode: "fixture" | "live", timeoutMs?}`; returns `{runId}`. JSON-LD, Certify, Inji Web, Verify, no tamper and no scenario preset are required.
- `GET /api/v1/assisted/runs/:id`: existing run/steps, transient action links and current deadline. Links never enter persisted exchange evidence.
- `POST /api/v1/assisted/runs/:id/cancel`: idempotent cancellation; late observations cannot reactivate a terminal run.
- `POST /api/v1/assisted/runs/:id/observations`: `{kind: "issuance" | "storage" | "presentation"}`. Issuance/presentation injections are fixture-only. Storage confirmation is explicit human confirmation, not an inference from capture.
- `POST /api/v1/runs/:id/capture/har`: existing synthetic/redacted capture contract, now supports managed active assisted runs.
- `GET /api/v1/runs/:id/capture/coverage`: authoritative coverage from persisted redacted browser exchanges.
- `GET /api/v1/matrix/cells`: supported combinations with explicit untested cells.

## Run the connected fixture

Start the normal playground. Select JSON-LD, Inji Certify, Inji Web Assisted, Inji Verify and no fault. In **Backend-assisted journey**, choose **Start connected fixture**. Inject fixture issuance, confirm fixture storage, inject presentation and wait for the fixture verifier's normalized result. The timeline/history show this backend run with fixture evidence. Cancel and restart to exercise cleanup. The older browser-only rehearsal remains available separately.

## Live deployment prerequisites — manual success, capture integration pending

Set `ASSISTED_LIVE_ENABLED=true` only after the dedicated account and pinned services exist. Supply HTTPS `ASSISTED_WALLET_URL`, `ASSISTED_OFFER_URL`, `CERTIFY_BASE_URL`, `VERIFY_BASE_URL`, plus a deployment-validated HTTPS `ASSISTED_PRESENTATION_URL_TEMPLATE` containing exactly one `{request_uri}` placeholder, deployment-specific `VERIFY_CLIENT_ID` and optional `CREDENTIAL_CONFIGURATION_ID`. These are endpoint/profile settings, not login secrets. Inji Web/Mimoto retains credentials, cookies, OTPs and wallet state; the assisted backend does not use the Reference Wallet's Postman credentials or holder key.

The live request link comes from the configured Verify request. The existing capture origin allowlist must match the canonical deployment. The current ingress is bounded HAR import, not an autonomous network sniffer; feed observed sanitized traffic while the run is active. Storage confirmation is a user assertion and still needs the manual persistence check and sanitized evidence in `A1_WEB_EVIDENCE.md`. A1 is signed off only after a real wallet stores and presents to Verify with `valid`. A dedicated account is now available on hosted Collab. On 23 October, a manual browser journey stored a Land Registry Registration Receipt in signed-in Inji Web, presented it through the HTTPS Web handoff, and received Verify’s visible Valid verdict. Both Registration Receipt and Farmer cards survived a wallet refresh. This was not a playground-managed run; exact issuance profile, correlated Exchange evidence and backend normalization remain to be validated. See `A1_WEB_EVIDENCE.md` and its sanitized screenshots. Final integrator sign-off remains pending.

## QA

Run `pnpm install --frozen-lockfile`, install Chromium with `pnpm --filter @playground/web exec playwright install chromium`, then `pnpm --filter @playground/web test:browser`. The test config starts independent local mocks, in-memory BFF and Vite on 4101/4102/4000/5173; stop existing servers first. Three browser tests cover fixture UX, independent mocks + synthetic capture, and connected backend-assisted completion/cancellation/matrix display. Browser artifacts go to `/tmp/person2-playwright-results`; reviewed synthetic screenshots and scoped axe results are under `submission/evidence/person2/`.

Exchange sequence allocation is serialized across capture imports, orchestration and fixture observations to preserve the database unique-sequence contract. Managed sessions are process-local; after a backend restart an interrupted persisted assisted run is reported as `ASSISTED_INTERRUPTED`, rather than silently resumed.

General checks: `pnpm test`, `pnpm typecheck`, `pnpm build`, `pnpm audit:secrets`, `git diff --check`. Database-specific capture tests retain their existing opt-in requirement. These checks establish the integrated fixture implementation; they do not establish real A1 acceptance.

Validated on 23 October: the full unit/API suite, typecheck, production build and secret audit pass; two database-dependent tests remain skipped. All three Chromium browser checks pass, including reconnect through history after reload, connected completion/cancellation and the server matrix. Scoped axe/contrast checks report zero violations. The legacy generic start/replay path rejects assisted wallets, preventing automated-wallet relabeling.

## Review corrections

Status polling is serialized and stops on terminal state; old-run responses are ignored. Coverage reads carry a generation number so a delayed initial read cannot overwrite a newer import. Regression tests cover both races.

Live presentation observations must match the configured verifier origin and the expected run-scoped HMAC of the signed request's state. Raw state is not persisted. Missing/short state or mismatched/redacted correlation fails closed; the driver cannot accept unrelated same-run traffic. A separately running local HAR filter uses a different process key and cannot supply this correlation unchanged. Do not bypass filtering with real-session raw HAR: a live capture adapter must preserve the approved same-process state tag, or the run remains unverified/times out. This integration compatibility must be checked before A1.

A generic native `openid4vp://` URI is no longer advertised as an Inji Web handoff. Live start requires the explicitly configured HTTPS Web launch template; its request URI is encoded into the placeholder. The hosted route was exercised successfully in the manual browser journey below. Compatibility with the backend-created request profile still needs a managed live run; fixture results do not establish it.

### Observed hosted Web presentation route — 23 October 2026

Verify’s VP Verification → Land Registry → Open Web Wallets → Inji Wallet launched the following route (the real request identifier is intentionally omitted):

```text
https://injiweb.collab.mosip.net/user/authorize?client_id=decentralized_identifier%3Adid%3Aweb%3Ainjiverify.collab.mosip.net%3Av1%3Averify&request_uri={request_uri}
```

The manual flow completed matching, consent, sharing and visible Verify acceptance using the Land Registry Registration Receipt. The verifier must request only Land Registry: explicitly uncheck the default MOSIP ID and verify checkbox states. Inji Web displayed Trusted after the user-approved trust change. The exact issuance endpoint/configuration ID, protocol profile and compatibility with backend-created requests still require capture integration validation. The successful UI result is not a normalized managed-run result and does not change evidence tiers.
