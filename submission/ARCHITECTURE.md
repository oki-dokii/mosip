# Implemented architecture

```mermaid
flowchart LR
  User[Judge / test operator] --> Web[React + Vite playground]
  Web -->|REST API| BFF[Express BFF]
  Web <-->|Socket.IO summaries| BFF
  BFF --> Orchestrator[Run orchestrator]
  Orchestrator --> Drivers[Issuer / wallet / verifier drivers]
  Drivers --> RefWallet[Reference Wallet in BFF]
  Drivers --> Certify[Inji Certify]
  Drivers --> Esignet[eSignet]
  Drivers --> Verify[Inji Verify]
  Drivers --> Mocks[Optional mock issuer / verifier]
  Orchestrator --> Redaction[Write-time redaction]
  Redaction --> Store[(Memory or PostgreSQL run store)]
  BrowserHAR[Synthetic browser HAR] --> Import[Bounded allowlisted HAR import]
  Import --> Store
  Store --> Reports[Report, history, matrix, sequence]
  Reports --> BFF
```

The operator chooses a scenario or role combination. The BFF creates a run, executes named steps through adapters, redacts each exchange before storage, and sends small Socket.IO events. The web app fetches stored run details and renders the timeline, inspector, sequence, reports, and latest-result matrix. Reports label fixture, mock, and Reference Wallet evidence separately.

`PLAYGROUND_DRIVER_MODE=fixture` uses deterministic local responses. `collab` uses Inji Certify/eSignet and Inji Verify with the automated Reference Wallet; optional independent mocks can take an issuer or verifier role. The BFF keeps live credentials, tokens, keys, and cookies in per-run memory and stores sanitized exchange summaries. Browser HAR import observes synthetic traffic after a run; it never forwards or rewrites signed protocol requests.

The diagram covers the common run pipeline. The [managed local Web record](evidence/2026-10-26-person2-local-ui/run-report.json) traces the separate Certify → Inji Web/Mimoto → Verify journey. The Android page reads the manual evidence catalog. Mobile validation uses the existing Inji Wallet app; the team is not building a new mobile app. `pnpm demo:docker` now packages the playground, PostgreSQL, and separate mocks; it does not package local Inji services. See [DEPLOYMENT.md](../docs/DEPLOYMENT.md).
