# Five-day catch-up plan and competitive calibration

Updated 2026-10-21. The working freeze is 2026-10-26 21:00 IST, with an A1/A2 decision point on 2026-10-24 21:00 IST. Change those when the official submission time is known. This document narrows work by judging value; it does not treat another team's README as our evidence.

## What was checked

The public [Badmosip README](https://github.com/Paradox-73/Interoperability_Playground_for_Verifiable_Credentials) describes a bundled local Inji stack, Inji Web, broad scenario coverage, CI, and a gap register. The public [MangoBites README](https://github.com/TheHarshal30/MangoBites) describes a smaller local Certify/Verify stack, matrix, and gaps, while explicitly saying Inji Web and a physical phone run are absent. These are **their documented claims**, not tests we ran. [Mushmat/inji_sandbox](https://github.com/Mushmat/inji_sandbox) is a more complete project than its title alone suggested; its README describes a local multi-service stack but also lists private setup files and a scripted Digital Credentials API answer. We have not evaluated its running system. We will use these repositories as scope and test leads only; do not copy source, fixtures, keys, or UI.

The [official Certify bundled-stack guide](https://github.com/inji/inji-certify/tree/develop/docker-compose/docker-compose-injistack) already has Certify, Mimoto, and Inji Web examples, but its documented Web path requires an OIDC client keystore, partner configuration, and sign-in setup; its bundled Verify service is commented out in the Compose example inspected on 2026-10-21. A local stack is therefore **high priority, not automatic A1 proof**. It also needs a functioning Docker daemon and enough memory. The [official Inji Web Compose guide](https://github.com/inji/inji-web/tree/develop/docker-compose) likewise documents OAuth client credentials and a keystore.

## Priority order

| Priority | Deliverable | Owner / gate | Proof required |
|---|---|---|---|
| P0 | One-command **playground core + mocks** bundle (A6) with CI smoke | Person 4 | `pnpm demo:docker` and the two-cell baseline/bad-signature mock matrix passed locally on 2026-10-21; [hosted CI](https://github.com/oki-dokii/mosip/actions/runs/39632729703) passed both jobs. Separate clean-machine rehearsal remains. |
| P0 | Add a **pinned local Inji profile** as the primary live-integration target: Certify + Verify first; Mimoto + Inji Web for A1 once auth materials are available | Person 4 infrastructure; Person 2 wallet wiring; integrator contract | Exact upstream image tags/config provenance, service health, one Certify → Reference Wallet → Verify run, then wallet storage/presentation separately. Do not relabel a partial stack as A1. |
| P0 | A1/A2 go/no-go by 2026-10-24 21:00 IST | Persons 2 and 3 | Pinned wallet build, observed store/present, verifier outcome, sanitized report; otherwise exact blocker in [wallet validation](WALLET_VALIDATION.md). |
| P1 | First-class independent gap probes and committed reports | Person 3, integrator for reports | One-variable synthetic reproducer, expected/actual, run ID, release label or `unreported`, redacted artifact; [GAPS.md](GAPS.md). |
| P1 | Hosted CI plus a scheduled matrix once the local mock/live profile is stable | Person 4 | Hosted checks and a **synthetic mock** matrix passed. The daily schedule is configured but its first scheduled execution is pending; schedule a live matrix only if secrets/config and stack are reliable. |
| P1 | Browser smoke, keyboard/contrast/axe check, annotated screenshots | Person 2 | Automated smoke and saved results; visible UI examples for judges. |
| P2 | Correctly signed expired/wrong-type and wrong-holder cases | Person 3 | Fault isolated from signature corruption; verifier reason recorded. |
| Defer | mDoc, telemetry, Digital Credentials API, broad same-device expansion | Integrator decision | Only after A6, wallet decision, and core evidence are settled. |

## Gap leads versus observations

| Lead from other projects | Our present evidence | Next experiment |
|---|---|---|
| Nonce replay acceptance | **Not reproduced by our current nonce-mismatch probe.** On 2026-10-21, public Collab Verify returned HTTP 400 `invalid_request`; the playground then errored while waiting for status. [Sanitized run](submission/evidence/2026-10-21-nonce-mismatch.json). This probe changes the nonce in a new presentation; it is not a byte-for-byte replay of an earlier VP. The 2026-10-22 harness change treats HTTP 400 as a terminal invalid submission in a synthetic test; the live case has not been rerun. | Person 3: rerun the nonce-mismatch case, then separately resubmit a previously accepted `vp_token` against a fresh challenge. Pin Verify release before comparing with a reported 0.16 finding. |
| Wrong-holder JSON-LD VP accepted | Untested here. | Make a valid credential and a VP signed by a different holder key; retain valid issuer proof. Requires a real JSON-LD path. |
| `did:jwk` issuer rejected / SD-JWT key only from `x5c` | Our `did:jwk` path failed and X.509 path passed, but no exact-key-resolution trace proves “only from `x5c`.” [Phase 3](PHASE3.md). | Pin Verify version and isolate `x5c` versus issuer metadata/DID resolution. |
| `did:web` HTTPS default-port constraint | Untested here. | Use a controlled test DID host on standard and nonstandard HTTPS ports. |
| Remote JSON-LD context HTTP 429 | Untested here. | Record context fetch result and rate-limit headers; do not induce excess traffic against public services. |
| Inji Web SD-JWT presentation unavailable | Observed in the tested guest/Web path; current release behavior needs recheck. [Contract fixture](spikes/fixtures/collab-contracts-2026-10-20.json). | Test pinned local Web/Mimoto build after login configuration, distinguish unsupported format from missing account. |

## Daily integration checkpoints

| Date (IST) | Finish line |
|---|---|
| 21–22 Oct | Pin official local-stack versions and prerequisites; get Docker running; core Compose and mock smoke first. Preserve separate authors on new commits. |
| 23 Oct | Certify/Verify local path and first independent gap probes; CI runs offline checks. |
| 24 Oct by 21:00 | Decide A1/A2 on observed evidence; publish exact blockers if missing. Spend remaining time on A6 and quality. |
| 25 Oct | Stable hosted CI, accessible browser smoke, sanitized matrix/gaps, installation rehearsal. |
| 26 Oct by 21:00 | Freeze, clean-machine run, secret/license audit, deck/video and final link checks. |

The main differentiator to explain in the pitch is the safe capture/redaction pipeline, explicit evidence-tier labels, and external mock roles. Those are already implemented; the remaining work is to make them easy for judges to reproduce and to add enough independently verified interoperability findings to support the problem statement's second goal.
