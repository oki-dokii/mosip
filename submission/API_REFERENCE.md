# Current BFF API quick reference

Local base URL: `http://localhost:4000/api/v1`. All routes below are implemented in `apps/bff/src/app.ts`. The local BFF currently has **no user-authentication layer**; use synthetic test data and keep it on a trusted development network. Upstream Collab credentials are supplied through server-side environment configuration, never an API request body.

| Method | Path | Request | Response |
|---|---|---|---|
| GET | `/health` | — | Playground process/storage/driver-mode summary |
| GET | `/meta/implementations` | — | Issuer, wallet, verifier, and format choices |
| GET | `/scenarios` | — | `{ items: ScenarioDefinition[] }`, including availability reason |
| GET | `/assisted/capabilities` | — | `{ liveAvailable, fixtureAvailable }` for the JSON-LD Inji Web assisted path |
| POST | `/assisted/runs` | `{ "config": RunConfig, "mode": "fixture" \| "live", "timeoutMs"?: 100–300000 }` | `202 { runId }`; `400` invalid body; `422` unsupported or unconfigured live path |
| GET | `/assisted/runs/:id` | — | `{ run, steps, actions, deadlineAt }`; action links are transient, not stored as exchanges |
| POST | `/assisted/runs/:id/cancel` | — | `202` with assisted status, or `404` |
| POST | `/assisted/runs/:id/observations` | `{ "kind": "issuance" \| "storage" \| "presentation" }` | `202 { accepted: true }`; `409` inactive or wrong stage. Issuance/presentation injection is fixture-only; live storage is a human confirmation, not independent proof. |
| POST | `/runs` | `RunConfig` JSON | `202 { runId }`; `400` invalid config; `422` unavailable/edited scenario or unsupported combination |
| GET | `/runs` | Optional issuer, wallet, verifier, format, status, tamper, issuerVersion, verifierVersion query filters | `{ items: RunSummary[] }` |
| GET | `/runs/:id` | — | `RunSummary` or `404` |
| GET | `/runs/:id/steps` | — | `{ items: RunStep[] }` |
| GET | `/runs/:id/exchanges` | Optional `stepId` query | `{ items: Exchange[] }`, sanitized |
| POST | `/runs/:id/replay` | `{ "tamper": null | faultKind }` | `202 { runId }`; fresh child run with cleared scenario ID |
| POST | `/runs/:id/capture/har` | `{ "runId": "same UUID", "har": { "log": { "entries": [...] } } }` | Import counts, skip reasons, per-step coverage and capture gaps; synthetic test traffic only, after a finished run |
| GET | `/runs/:id/capture/coverage` | — | `{ coverage }` derived from saved sanitized browser exchanges; unavailable boundaries remain explicit |
| GET | `/runs/:id/report?format=json\|md` | — | Downloadable report with evidence tier |
| GET | `/runs/:id/sequence` | — | Mermaid source and exchange/step markers |
| GET | `/matrix` | — | Latest run for each role/format/fault/evidence-tier/scenario/profile/issuer-representation combination |
| GET | `/matrix/cells` | — | `{ items }` of supported positive-control combinations; each has `status`, `testedAt`, `evidence`, and `runId`, with absent runs marked `not_tested` |
| GET | `/matrix/export?format=json\|csv\|md` | — | Downloadable latest-result matrix |

Example run body:

```json
{
  "issuer": "inji_certify",
  "wallet": "reference_wallet",
  "verifier": "inji_verify",
  "format": "vc_sd_jwt",
  "flow": "cross_device",
  "tamper": null,
  "scenarioId": null
}
```

Use `GET /scenarios` to obtain a preset's exact `config`; changing a field while keeping its `scenarioId` returns `SCENARIO_CONFIG_MISMATCH`. In fixture mode, a successful run is simulated. In Collab mode, the BFF needs the configured upstream environment. The `capture/har` route accepts at most 2 MiB and 100 entries, validates allowed origins, redacts before persistence, and never stores the raw HAR; see [CAPTURE.md](../CAPTURE.md).

The assisted API accepts only Inji Certify → Inji Web assisted → Inji Verify, JSON-LD, cross-device, with no tamper or scenario ID. Its connected fixture mode is reproducible without a wallet account. Live mode additionally requires configured HTTPS wallet, offer and presentation links plus Certify/Verify settings; `liveAvailable: true` means configured, not that a wallet run passed. Managed assisted sessions are process-local. A restarted BFF reports an interrupted run instead of resuming it. The ordinary `/runs` and `/runs/:id/replay` routes reject assisted-wallet requests with `USE_ASSISTED_API`.

Socket.IO namespace `/runs` accepts `join(runId)` and sends `run:created`, `step:started`, `exchange:recorded`, `step:finished`, and `run:finished` summaries. Fetch exchange bodies over REST; do not infer raw payloads from events.

### Capture response and public projection

The additive import response is `{ imported, skipped, skippedReasons, coverage, gaps }`. Each coverage item has `stepKey`, `state` (`captured`, `missing`, `not_observable`), `count`, and `reason`. Coverage describes browser observation and does not change a run result. Imported request/response envelopes include a versioned `publicView` with `authenticity: "not_verified"`; request metadata also records the tagging rule, reason, timing certainty and redaction count. No shared Exchange type or database migration was added.

The endpoint requires `Content-Type: application/json`. Stable capture errors include `CAPTURE_JSON_REQUIRED` (415), `CAPTURE_RATE_LIMITED` (429 with `Retry-After`), malformed JSON/top-level HAR (400), active/cross-run imports (409), unapproved origins (422), and unsafe sizes (413). The per-process rate limit is ten attempts per minute per transport peer. See [the capture contract](../CAPTURE_CONTRACT_PROPOSAL.md) and [security boundaries](../SECURITY.md).

### Protocol evaluation (additive)

`RunSummary` may include `protocolProfile` (`fixture-v1`, `mock-sdjwt-flat-v1`, `legacy-mock-v1`, `collab-dcql`), `issuerRepresentation` (`did:jwk`, `x509`, `unreported`) and `evaluation` (schemaVersion 1). Evaluation includes expected and observed outcome, boundary, application step, stage and code. Verdicts are `correct_acceptance`, `correct_rejection`, `unexpected_rejection`, `wrongly_accepted`, `wrong_step`, `wrong_reason`, `inconclusive`. Only the first two pass a run. Unknown detailed reasons, service failures and missing verdicts cannot pass a negative scenario.

Metadata is saved in existing step JSON and reconstructed on reads; no migration is required. Historical records can omit it. Matrix grouping includes scenario/profile/issuer representation; CSV/Markdown append evaluation columns. Ten presets are available, including six controlled mock cases. Signed expiry/type variants require a controlled mock issuer; for external mock services set `MOCK_ISSUER_ENABLE_TEST_CASES=true` on both issuer and BFF. Missing-disclosure isolation requires the strict mock pair. The `replay_nonce` API enum continues to mean nonce mismatch; genuine byte replay is a separate harness case.
