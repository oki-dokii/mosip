# A1 — Inji Web JSON-LD wallet evidence

Status on 23 October 2026: **MANUAL LIVE JOURNEY SUCCEEDED; INTEGRATOR SIGN-OFF PENDING**.

The dedicated signed-in Inji Web account stored a sandbox Land Registry Registration Receipt credential, presented it to hosted Inji Verify, and received the visible verdict **“Congratulations, the given credential is valid!”**. The credential remained in Stored Cards after a full page refresh. This was a manual browser journey, not a playground-managed assisted run. Correlated redacted Exchange evidence and backend request-profile compatibility still require integration validation; this document does not promote the automated evidence tier or claim Person 1 capture integration passed.

## Evidence record

Operator: Codex browser automation with the user's authorization; account setup, wallet passcode creation/unlock and private authentication input were performed by the user. Date: 23 October 2026, approximately 20:40 Asia/Kolkata at presentation. Browser: Codex in-app browser; engine/version and deployment image versions unreported. Playground run ID: none (manual run).

| Checkpoint | State | Evidence |
|---|---|---|
| Dedicated persistent account/login | Observed | User-created Google test account; passcode onboarding/unlock completed by user |
| Real issuance | Observed through wallet UI | Farmer ID Card and Land Registry Registration Receipt issued through signed-in Web flows |
| Persistent wallet storage | Observed after refresh | [Stored cards](evidence/person2/live-stored-cards-after-refresh.png); neither guest download nor Reference Wallet |
| Matching presentation request | Observed | Verify VP Verification; only Land Registry checked; Open Web Wallets → Inji Wallet |
| Trusted verifier | Observed | User explicitly approved trust; subsequent wallet request displayed Trusted |
| Wallet presentation | Observed | Registration Receipt selected; Confirm and Share + consent confirmation; wallet reported Credentials Shared |
| Verify acceptance | Observed UI verdict | [Valid result](evidence/person2/live-verify-valid.png); Registration Receipt Credential — Valid |
| Protocol capture / normalized playground outcome | Not collected | No managed run, exchange IDs, sanitized request/response chain or backend normalization from this manual session |
| Integrator review | Pending | Review manual evidence and complete capture/profile validation before final A1 sign-off |

## Reproduce with the dedicated test account

Do not put credentials, OTPs, cookies, full VCs, private keys or real-session HAR in this document or in the playground. Login and wallet state remain in Inji Web/Mimoto. Use only sanctioned sandbox data.

1. Open https://injiweb.collab.mosip.net and sign in to the dedicated Google test account. The operator enters the existing wallet passcode privately.
2. Open **AgroVeritas Property & Land Registry** and select **REGISTRATION RECEIPT OF THE RURAL PROPERTY IN CAR**. The observed issuer authorization scope was `land_registry_vc_ldp`; the exact credential configuration ID and protocol draft were not independently recorded.
3. Authenticate through the public mock identity setup documented in the official [Credential Providers guide](https://docs.inji.io/inji-wallet/inji-mobile/technical-overview/customization-overview/credential_providers) and [Using Mock Data](https://docs.inji.io/readme/try-it-out/using-mock-data). Public identity/OTP values are intentionally omitted here. Personal phone signup is unnecessary.
4. Wait for the card in **Stored Cards**. Refresh and verify it remains. The Farmer card was also stored successfully, but was not the credential used for the successful presentation.
5. Open https://injiverify.collab.mosip.net/verify → **VP Verification** → **Request Verifiable Credentials**. Check **Land Registry** and uncheck the default **MOSIP ID**. Verify actual checkbox state: clicking row text alone did not toggle it in this session.
6. Choose **Open Web Wallets** → **Inji Wallet** → **Proceed**. Verify opens the HTTPS Web route documented below.
7. Trust the exact Verify identity only with explicit user authorization if prompted. Review the matching Registration Receipt card, choose **Confirm and Share**, then confirm the consent dialog.
8. Observe **Credentials Shared** in Inji Web, followed by return to Verify and **Registration Receipt Credential — Valid**. Keep the details collapsed so no credential claims enter screenshots.

## Observed endpoints and handoff

- Web: https://injiweb.collab.mosip.net ; Mimoto is hosted beneath `/v1/mimoto`.
- Issuer login: https://esignet-mock.collab.mosip.net ; observed client `mpartner-default-mimoto-land-oidc`.
- Verify: https://injiverify.collab.mosip.net ; API root `/v1/verify`.
- Person 4 supplied Farmer Certify at https://injicertify-farmer.collab.mosip.net . The actual Land Registry issuance endpoint was not captured, and must be confirmed rather than inferred from the issuer label.
- Verifier identity: `decentralized_identifier:did:web:injiverify.collab.mosip.net:v1:verify`.
- Same-device Web template, with transient request identifier omitted:

```text
https://injiweb.collab.mosip.net/user/authorize?client_id=decentralized_identifier%3Adid%3Aweb%3Ainjiverify.collab.mosip.net%3Av1%3Averify&request_uri={request_uri}
```

## Remaining integration checks

- [x] Dedicated account, real wallet issuance, persistent storage, wallet presentation and visible Verify valid verdict.
- [x] Sanitized screenshots reviewed visually: listing/verdict only; no credential contents, QR payload, login identifiers or tokens.
- [ ] Confirm exact issuer/configuration ID, deployment versions and protocol profile for the successful Registration Receipt flow.
- [ ] Repeat through a playground-managed live run with Person 1's approved redacted capture adapter; preserve run/step/exchange IDs and same-process state correlation. Do not import raw real-session HAR to bypass the capture contract.
- [ ] Record issuance and presentation observations, storage-confirmation provenance, missing/not-observable coverage, and normalized valid outcome for that managed run.
- [ ] Integrator reviews evidence and signs off A1. Existing shared evidence-tier rules remain unchanged.

## Earlier attempts and limits

Google onboarding and wallet unlock required user input; no passcode was read or stored. The first trust click returned to login; a fresh authenticated request later succeeded and displayed Trusted. Initial no-matching-card attempts did not verify checkbox changes correctly and may have retained the default MOSIP ID; they do not establish a Farmer-versus-Land compatibility verdict. After actual checkbox values were verified with only Land Registry selected, the Registration Receipt matched and presented successfully. The Farmer preview reported no generated QR; QR verification is not claimed. No API payload, signed VP, raw credential, session HAR or authentication material was retained.

Person 4's local packaging profile remains separately blocked on upstream configuration; it was not used for this hosted manual success. Fixtures and independent mocks remain separate evidence.
