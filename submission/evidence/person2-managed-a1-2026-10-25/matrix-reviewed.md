# Interoperability matrix

| Issuer | Wallet | Verifier | Format | Fault | Status | Expected | Actual | Evidence | Run | Scenario | Profile | Issuer method | Evaluation | Expected code | Observed code |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| inji_certify | inji_web_assisted | inji_verify | ldp_vc | none | passed | valid | valid | unverified | `3dc6895d-ff87-45a2-a10b-46844198d83e` | custom | collab-dcql | unreported | correct_acceptance |  |  |

# Observed real-wallet compatibility

Manual evidence applies only to the recorded credential and deployment. It does not change managed-run outcomes or evidence tiers.

## Inji Web (real wallet) · Land Registry Registration Receipt

- Evidence ID: a1-web-land-registry-2026-10-23
- Record kind: manual_wallet_observation
- Observed: 2026-10-23
- Format: ldp_vc
- Outcome: valid (verifier_ui)
- Deployment: Hosted Collab Inji Web/Mimoto, Land Registry Certify and Verify
- Versions (issuer / wallet / verifier): unreported / unreported / unreported
- Managed run ID: 3dc6895d-ff87-45a2-a10b-46844198d83e
- Managed validation: passed
- Review: pending_integrator_review

### Checkpoints

- Issuance: observed. Credential appeared in the dedicated signed-in wallet.
- Persistent storage: observed. Registration Receipt remained in Stored Cards after a full page refresh.
- Presentation: observed. The same wallet matched the Land Registry request, obtained consent and reported Credentials Shared.
- Verifier acceptance: observed. Inji Verify displayed Registration Receipt Credential — Valid.

### Limits

- This manual observation is preserved separately from the linked fresh managed run on 25 October.
- Managed run used RegistrationReceiptCredential and collab-dcql; deployed releases remain unreported, and browser capture omits downstream server calls.
- A1 team review remains pending; no general JSON-LD conformance claim or evidence-tier promotion.

### Source artifacts

- [Fresh managed A1 run and capture limits](https://github.com/oki-dokii/mosip/blob/90c7b36/submission/evidence/person2-managed-a1-2026-10-25/README.md)
- [Managed run report](https://github.com/oki-dokii/mosip/blob/90c7b36/submission/evidence/person2-managed-a1-2026-10-25/run-report.json)
- [A1 evidence and checklist](https://github.com/oki-dokii/mosip/blob/1537c55287ccbbf9ed9edd113ce2c46fc05c6681/submission/A1_WEB_EVIDENCE.md)
- [Stored cards after refresh](https://github.com/oki-dokii/mosip/blob/1537c55287ccbbf9ed9edd113ce2c46fc05c6681/submission/evidence/person2/live-stored-cards-after-refresh.png)
- [Verify Valid screenshot](https://github.com/oki-dokii/mosip/blob/1537c55287ccbbf9ed9edd113ce2c46fc05c6681/submission/evidence/person2/live-verify-valid.png)
- [Observed hosted route limits](https://github.com/oki-dokii/mosip/blob/fab1288306bd52c3b7942468f1dc6f45f2e82987/submission/PERSON2_HOSTED_ROUTE_HANDOFF.md)

## Inji Wallet Android (real wallet) · Playground SD-JWT Identity

- Evidence ID: a2-android-sdjwt-2026-10-23
- Record kind: manual_wallet_observation
- Observed: 2026-10-23
- Format: vc_sd_jwt
- Outcome: valid (correlated_verifier_response)
- Deployment: Hybrid: pinned official local Certify and public Collab Verify; Nothing Phone (2a), Android 16
- Versions (issuer / wallet / verifier): 1.0.0-alpha.1 / 1.0.0-alpha.1 (About screen) / unreported
- Managed run ID: none
- Managed validation: pending
- Review: recorded_manual_acceptance

### Checkpoints

- Issuance: observed. Real Android wallet listed Playground SD-JWT Identity.
- Persistent storage: user_confirmed. User confirmed that the card remained after closing and reopening; reopening was not independently recorded.
- Presentation: observed. Wallet matched the stored card, requested consent and reported successful sharing.
- Verifier acceptance: observed. Correlated Inji Verify response: valid; credential proof and holder proof true.

### Limits

- Manual mobile acceptance; no playground-managed run or native traffic capture.
- Hybrid deployment; installed binary attestation and Verify release remain unreported.
- User-confirmed persistence is distinct from independent observation; selective claim-policy behavior was not isolated.

### Source artifacts

- [A2 acceptance report](https://github.com/oki-dokii/mosip/blob/a638911cd9fc54b147a643b05a6155f02937c7b7/submission/A2_MOBILE_EVIDENCE.md)
- [Mobile attempt and provenance](https://github.com/oki-dokii/mosip/blob/a638911cd9fc54b147a643b05a6155f02937c7b7/submission/evidence/person3-a2-mobile-2026-10-23/attempt.json)
- [Wallet share success](https://github.com/oki-dokii/mosip/blob/a638911cd9fc54b147a643b05a6155f02937c7b7/submission/evidence/person3-a2-mobile-2026-10-23/04-wallet-share-success.jpg)
- [Correlated verifier result](https://github.com/oki-dokii/mosip/blob/a638911cd9fc54b147a643b05a6155f02937c7b7/submission/evidence/person3-a2-mobile-2026-10-23/verifier-result.json)
