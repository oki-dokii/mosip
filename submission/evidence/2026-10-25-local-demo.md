# Local Compose demo rehearsal — 25 October 2026

**Checkout:** `f11af84` on `main` (includes the read-only A1 archive).  
**Host:** macOS with Docker Desktop Engine 29.9.2.  
**Command:** `bash scripts/demo-docker.sh` from the repository root.  
**Result:** `DEMO PASS`; the web app remained available at `http://localhost:5174`.

The script built the web app, BFF, PostgreSQL migration and two standalone mock services from this checkout. Compose reported PostgreSQL, BFF, web, mock issuer and mock verifier healthy. It then ran the six synthetic, cross-container SD-JWT cases below. Every case persisted ten steps and seven sanitized exchanges with `mock_interop` provenance.

| Scenario | Observed outcome | Run ID |
|---|---|---|
| Baseline | `valid` | `b51b9745-d115-498c-a359-d126a664a545` |
| Bad signature | `invalid` | `57cd4ad3-927e-4e80-a5df-5f78075f5f62` |
| Signed expiry | `invalid` | `9a2152d6-8c4a-4893-89d0-4ac1d2bc6c20` |
| Signed wrong type | `invalid` | `eb025dac-a492-43ae-beba-9a085a95052f` |
| Missing required disclosure | `invalid` | `169aecf5-39e9-4eb2-a957-8cd1f174156c` |
| Nonce mismatch | `invalid` | `d79db435-9ba5-48a7-9e36-5aae694a0f1d` |

The same fresh BFF exposed the committed managed A1 record `3dc6895d-ff87-45a2-a10b-46844198d83e` in run history. `GET /runs/:id` returned `recordKind: archived_evidence`, `status: passed`, wallet version `unreported`, ten steps and seven exchanges. This is a read-only projection of the 25 October export, **not** another live Inji Web trial. The mock cases do not establish Inji component interoperability. The [managed A1 evidence bundle](person2-managed-a1-2026-10-25/README.md) documents its own observed chain and limits.

Hosted CI for code commit [`2e01dfe`](https://github.com/oki-dokii/mosip/actions/runs/40167968420) separately passed typecheck, tests, build, secret audit, browser/axe checks and Compose smoke. This local rehearsal confirms the same reviewer path on the development Mac; an independent human/machine install remains a final submission check.
