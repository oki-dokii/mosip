# A1 — Inji Web JSON-LD wallet evidence

Status on 23 October 2026: **BLOCKED / NOT SIGNED OFF**.

No dedicated persistent Inji Web test account has been supplied. A usable pinned Web/Mimoto endpoint with authentication configuration has not been handed to Person 2. The fixture journey and independent mock tests are separate evidence; neither closes A1.

## Manual checklist for the dedicated test account

Do not put credentials, OTPs, cookies, full VCs, private keys or real-session HAR in this document or in the playground. Account login remains in Inji Web/Mimoto.

- [ ] Person 4 supplies canonical Web/Mimoto, Certify and Verify endpoints and pinned versions/configuration provenance.
- [ ] A dedicated persistent test account exists, with login details supplied outside repository/evidence storage.
- [ ] Record operator, timestamp/timezone, platform/browser, run ID, wallet build, Web/Mimoto/Certify/Verify versions, JSON-LD configuration ID and protocol profile/draft if known. Mark unknown versions `unreported`.
- [ ] Log in through Inji Web/Mimoto. Record login as observed without saving authentication state in the playground.
- [ ] Accept the Certify offer in the real wallet. Record redacted issuance evidence and its run/step/exchange IDs.
- [ ] Confirm the VC is visible in the persistent wallet after reopening/refreshing the wallet. A download response or guest file download is insufficient.
- [ ] Launch the verifier request using the supported request link, same-device link or QR.
- [ ] Present that JSON-LD VC from the same Inji wallet. Record redacted presentation evidence and transaction correlation.
- [ ] Obtain the normalized Inji Verify result `valid`, associated with the same request/transaction.
- [ ] Record storage-confirmation provenance separately from browser capture and verifier acceptance separately from presentation transport.
- [ ] Save only sanitized screenshots and reports; verify canaries/secrets are absent from API, DOM and exported evidence.
- [ ] Record coverage gaps (`missing` / `not_observable`), run IDs, deployment versions and any limitations. Preserve wallet identity and the agreed evidence tier.
- [ ] Integrator reviews the complete chain before changing A1 status to passed.

## Evidence record

| Checkpoint | State | Evidence |
|---|---|---|
| Real account/login | Unavailable | Dedicated account absent |
| Real issuance | Unobserved | No live account flow |
| Persistent wallet storage | Unobserved | Not inferred from HTTP or guest download |
| Wallet presentation | Unobserved | No real-wallet submission |
| Inji Verify valid result | Unobserved | No correlated real-wallet transaction |

If a run is attempted, record each checkpoint as observed, failed or unavailable, with sanitized evidence IDs and an exact blocker. A timeout is not a credential-rejection verdict. The existing shared evidence helper keeps non-fixture assisted runs `unverified`; only the integrator may introduce a new reviewed tier.
