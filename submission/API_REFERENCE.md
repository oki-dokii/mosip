# Current BFF API quick reference

Local base URL: `http://localhost:4000/api/v1`. All routes below are implemented in `apps/bff/src/app.ts`. The local BFF currently has **no user-authentication layer**; use synthetic test data and keep it on a trusted development network. Upstream Collab credentials are supplied through server-side environment configuration, never an API request body.

| Method | Path | Request | Response |
|---|---|---|---|
| GET | `/health` | — | Playground process/storage/driver-mode summary |
| GET | `/meta/implementations` | — | Issuer, wallet, verifier, and format choices |
| GET | `/scenarios` | — | `{ items: ScenarioDefinition[] }`, including availability reason |
| POST | `/runs` | `RunConfig` JSON | `202 { runId }`; `400` invalid config; `422` unavailable/edited scenario or unsupported combination |
| GET | `/runs` | Optional issuer, wallet, verifier, format, status, tamper, issuerVersion, verifierVersion query filters | `{ items: RunSummary[] }` |
| GET | `/runs/:id` | — | `RunSummary` or `404` |
| GET | `/runs/:id/steps` | — | `{ items: RunStep[] }` |
| GET | `/runs/:id/exchanges` | Optional `stepId` query | `{ items: Exchange[] }`, sanitized |
| POST | `/runs/:id/replay` | `{ "tamper": null | faultKind }` | `202 { runId }`; fresh child run with cleared scenario ID |
| POST | `/runs/:id/capture/har` | `{ "runId": "same UUID", "har": { "log": { "entries": [...] } } }` | Import counts and capture-gap note; synthetic test traffic only, after a finished run |
| GET | `/runs/:id/report?format=json\|md` | — | Downloadable report with evidence tier |
| GET | `/runs/:id/sequence` | — | Mermaid source and exchange/step markers |
| GET | `/matrix` | — | Latest run for each role/format/fault/**evidence-tier** combination |
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

Socket.IO namespace `/runs` accepts `join(runId)` and sends `run:created`, `step:started`, `exchange:recorded`, `step:finished`, and `run:finished` summaries. Fetch exchange bodies over REST; do not infer raw payloads from events.
