# Meaningful feature parity and differentiation

Updated 2026-10-23 against our `main` and the public [Paradox-73 interoperability playground](https://github.com/Paradox-73/Interoperability_Playground_for_Verifiable_Credentials) at `c466e71`. This is a prioritised implementation backlog, not a claim that their results are ours. Reproduce every live result on our own pinned environment and save sanitized evidence before adding it to our matrix. Do not copy their code, UI, fixtures, keys, or reported findings.

The competition scores functionality and deliverable quality at 40% each. A feature counts here only if it gives a user a useful action or a reproducible observation, has a clear result, and can be demonstrated. Test count and matrix size are supporting evidence, not goals by themselves.

| Capability | Our current state | Next useful increment | Priority / proof |
| --- | --- | --- | --- |
| Local Inji Certify + Verify | Opt-in configuration only; mock Compose works | Build an independently configured, pinned local issuer/verifier stack with synthetic keys, database seed, health checks and a passing issue/present/verify smoke | **P0**: exact images/config, command, `Valid` run record on a clean host |
| Inji Web through Mimoto | Assisted fixture and capture UI; no live wallet proof | Add synthetic authenticated local identity and complete login, issue, stored card, consent, presentation | **P0**: browser recording and correlated Verify `Valid` result |
| Inji Wallet mobile | No pinned installed device result | Attempt SD-JWT with a supported pinned app build and real device; record each checkpoint or exact blocker | **P0**: A2 result, never infer it from Reference Wallet |
| Live compatibility matrix | Historical Collab evidence plus clean six-case mock CI matrix | Run an independently specified local Inji matrix with positive controls and version-pinned expected failures; mark unrun cells `not_tested` | **P0**: committed sanitized cells with run IDs and actual outcomes |
| Gap discovery | Four qualified observations; no upstream issue | Reproduce a few high-impact findings on our pinned stack, give minimal steps and link deciding cells; check for existing upstream issues | **P0**: quality and reproducibility over matching a count of 29 |
| Browser capture and protocol inspector | Bounded HAR import, write-time redaction, public-view metadata and coverage | Demonstrate capture on the real Web-wallet journey; show per-step observed/missing boundaries | **P0**: database, API and Socket.IO canary checks remain green |
| Run history and filters | Implemented | Add a shareable filtered URL only if it improves reviewer navigation | P2: link reopens the same filtered view |
| Replay with fault | Implemented for supported runs | Add one additional *independently meaningful* signed negative case only where our issuer/verifier can isolate it | P1: positive control, one-variable mutation, exact step/reason |
| Sequence playback | Implemented for exchanges | Add timestamped run-event playback only if it clarifies the demo better than the existing control | P2: offline replay sends no protocol request |
| Matrix export | CSV/Markdown and aggregate evidence implemented | Include new live cells and a compact expected-versus-actual summary | P1: re-export from saved runs, no manual result editing |
| Gap explorer | Implemented in web UI from `submission/gaps.json` | Link newly verified findings to exact evidence and matrix cells | P1: no unverified item labelled as a confirmed upstream defect |
| Public credential decoding | Safe metadata projection exists; raw claim values withheld | Add a format-specific structure view only when it preserves write-time redaction | P1: realistic credential canaries absent from storage, API and socket |
| Same-device deep link | Not implemented | Add after a real cross-device wallet pass, using the same pinned stack | P2: signed request and final verifier result correlated |
| Digital Credentials API | Not implemented | Add a browser-supported reference path only with explicit stand-in-wallet labelling | P2: supported browser test and unsupported-browser explanation |
| mDoc | Not implemented | Add reference-role format and parsing only if time remains after real Inji flows | P3: do not call reference-only mDoc an Inji pass |
| Telemetry | Logs and CI artifacts, no dedicated metrics view | Add run outcome/duration/error counters if they help identify regressions in nightly runs | P2: no token or claim labels in metrics |
| Demo and design | README, diagrams, synthetic screenshots, pitch outline | Record a rehearsed real flow and create the deck/video from observed evidence | **P0**: a judge can follow the story and repeat the result |

## Critical path

1. **Prove the local Inji services.** The competitor's [setup](https://github.com/Paradox-73/Interoperability_Playground_for_Verifiable_Credentials/blob/main/docs/setup.md) shows a synthetic local deployment can work. Our [local-stack note](deploy/INJI_LOCAL.md) currently treats missing production-style MOSIP infrastructure as a blocker; investigate a synthetic configuration independently, with pinned upstream sources and the necessary consent/authentication setup. A running container alone is not success.
2. **Prove A1 with the real Web wallet.** Record issue, storage, presentation, and Verify result for one JSON-LD credential. [Inji Web's published OpenID4VP description](https://docs.inji.io/inji-wallet/inji-web/overview/features/verifiable-credential-presentation-openid4vp) covers JSON-LD; SD-JWT Web presentation is not a safe assumption.
3. **Attempt A2 on mobile while A1 proceeds.** The [Inji Wallet SD-JWT presentation guide](https://github.com/inji/inji-wallet/blob/master/docs/sdjwt-vp-support.md) provides the protocol path; the exact installed build and device determine whether our attempt works.
4. **Turn these into evidence, not just screenshots.** Pin versions and protocol profile; preserve expected, actual, timestamp, run ID, and sanitized exchanges. Show `not_tested` and capture gaps explicitly.
5. **Rehearse and submit.** Repeat setup on a second machine, fix only reproducible failures, and make the pitch/deck/video demonstrate the same committed runs.

## Independent ownership if four people work concurrently

If one developer will own all remaining work instead, use the [single-owner handoff](SINGLE_OWNER_HANDOFF.md) and follow its dependency order.

- **Infrastructure:** local pinned Inji services, synthetic identity/authentication, Compose health/smoke, clean-host proof. Own `deploy/` and coordinate service URLs.
- **Wallet UX:** Web issue/store/present flow, browser recording and accessible evidence display. Own `apps/web/` and A1 evidence; consume the infrastructure endpoint contract.
- **Protocol:** mobile A2 attempt, live matrix specs and independent version-pinned gap reproductions. Own mobile/probe evidence and `GAPS.md`; send shared-schema changes to the integrator.
- **Capture and evidence:** real-browser capture, secret-boundary tests, gap explorer data, report export and evidence links. Own capture and evidence files; keep raw credentials outside Git.

The integrator reviews cross-package contracts and serializes merges into `main`, preserving authorship. Freeze any feature that lacks a runnable acceptance check or would jeopardize the working demo. The [readiness checklist](submission/READINESS.md) remains the source of truth for submission status.
