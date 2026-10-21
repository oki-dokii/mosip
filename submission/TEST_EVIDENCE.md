# Test cases and evidence snapshot

Snapshot: 2026-10-21, source commit `5a40ad3` before submission-only documents. Results below were rerun against that working tree with `pnpm test`, `pnpm typecheck`, and `pnpm build`; all commands exited successfully. They are automated regression evidence, not a fresh live Collab run.

| Test area | Result | What it establishes |
|---|---|---|
| Phase 1 contract fixture tests | 3 passed | Pinned sanitized contracts and previous JSON-LD/SD-JWT Reference Wallet evidence remain readable |
| Shared schema/evidence tests | 3 passed | Config defaults, fault enums, and provenance tiers |
| BFF tests | 34 passed | Driver selection, orchestration, capture redaction/API, scenario validation/API, reports, matrix, tampering, persistence contract |
| Mock issuer tests | 2 passed | Test issuer HTTP behavior and signing path |
| Mock verifier tests | 1 passed | Test verifier HTTP behavior |
| Web automated tests | None configured | Build/typecheck passed; browser happy-path test is still needed |
| Typecheck | Passed | All five workspace packages |
| Production build | Passed | All five workspace packages |

Total automated test cases reported by the current commands: **43 passed**. The spike tests assert committed fixtures; they do not contact Collab during `pnpm test`.

## Functional evidence to present accurately

| Case | Evidence | Current conclusion |
|---|---|---|
| Fixture issue → hold → present → verify | Fixture driver tests and local UI | Simulated flow works; no live interoperability claim |
| Certify → Reference Wallet → Verify, JSON-LD and SD-JWT | Prior sanitized Collab spike fixtures in `spikes/fixtures/` and [PHASE3.md](../PHASE3.md) | Reference Wallet interoperability passed at the recorded checkpoint; rerun for final demo if environment permits |
| Mock issuer → Reference Wallet → Inji Verify | [PHASE3.md](../PHASE3.md) | X.509 mock issuer passed at the recorded checkpoint; self-signed test certificate does not prove production trust |
| Malformed/cross-run/oversized HAR import | `apps/bff/src/capture/har.test.ts` | Rejected or redacted before stored inspector output |
| JSON-LD with real Inji Web/mobile wallet (A1) | No dedicated persistent Web account | **Not passed / externally blocked** |
| SD-JWT with real Inji mobile wallet (A2) | No pinned app/device result committed | **Not passed / needs validation** |
| One-command playground + mocks Compose (A6 slice) | [DEPLOYMENT.md](../DEPLOYMENT.md): 2026-10-21 local `pnpm demo:docker` printed `DEMO PASS`; the subsequent two-cell baseline/bad-signature matrix had 10 steps, 7 exchanges, and `mock_interop` provenance per cell. An earlier fixture run survived BFF restart | **Local smoke passed**; hosted CI, clean-machine rehearsal, and local Inji stack remain |

## Safe synthetic inputs

- `spikes/fixtures/collab-contracts-2026-10-20.json` — sanitized metadata/contract snapshot.
- `spikes/fixtures/collab-reference-wallet-jsonld-2026-10-20.json` and `spikes/fixtures/collab-reference-wallet-sdjwt-2026-10-20.json` — sanitized outcome snapshots; no complete credentials.
- BFF and mock test files construct synthetic requests and keys in memory; see `apps/bff/src/capture/har.test.ts`, `apps/mock-issuer/src/server.test.ts`, and `apps/mock-verifier/src/server.test.ts`.
- `.env.example` describes configuration names and placeholders. Do not submit an actual `.env`, Postman client configuration, OTP, bearer token, private key, real student identity, or raw HAR.

Before the final pitch, record the exact commit, environment, component versions, and timestamp for any new live result. Export a sanitized run report and verifier result; do not change a blocked case to “passed” based on fixture or Reference Wallet evidence.

**Later fresh live evidence:** [2026-10-21 mock X.509 positive/negative reports and matrix](evidence/README.md) were exported from new synthetic runs against public Collab Verify at commit `ec1cbbd`. They are `mock_interop` evidence, separate from the test-suite snapshot above and from A1/A2.
