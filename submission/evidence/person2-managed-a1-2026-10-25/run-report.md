# Interoperability run 3dc6895d-ff87-45a2-a10b-46844198d83e

- Status: **passed**
- Expected outcome: **valid**
- Actual outcome: **valid**
- Reason evaluation: **correct_acceptance**
- Protocol profile: `collab-dcql`
- Issuer representation: `unreported`
- Scenario: `custom`
- Expected rejection: `none` at `PRESENT_RESULT`
- Observed rejection: `unknown` at `PRESENT_RESULT`
- Evidence: **Wallet evidence unverified**
- Issuer: `inji_certify`
- Wallet: `inji_web_assisted`
- Verifier: `inji_verify`
- Format: `ldp_vc`
- Tamper: `none`
- Issuer version: `unreported`
- Wallet version: `reference-wallet/0.1.0`
- Verifier version: `unreported`

## Steps

| # | Step | Status |
|---:|---|---|
| 1 | Initialize run | succeeded |
| 2 | Discover issuer and create offer | succeeded |
| 3 | Authorize wallet and exchange token | succeeded |
| 4 | Issue holder-bound credential | succeeded |
| 5 | Store credential for this run | succeeded |
| 6 | Create signed presentation request | succeeded |
| 7 | Submit holder-bound presentation | succeeded |
| 8 | Wait for verifier submission status | succeeded |
| 9 | Verify credential and holder proof | succeeded |
| 10 | Build run result | succeeded |

## Sanitized exchanges

### 1. GET https://injicertify-landregistry.collab.mosip.net/.well-known/openid-credential-issuer

**inji_web_assisted → inji_certify · HTTP 200 · 225 ms**

Request:
```json
{
  "accept": "application/json"
}
```

Response:
```json
{
  "credential_issuer": "https://injicertify-landregistry.collab.mosip.net/",
  "credential_configuration_id": "RegistrationReceiptCredential",
  "format": "ldp_vc",
  "supported": true
}
```

Redactions: none

### 2. POST https://injiweb.collab.mosip.net/v1/mimoto/wallets/{id}/credentials

**browser → mimoto · HTTP 200 · 4078 ms**

Request:
```json
{
  "source": "live_bridge",
  "headers": {},
  "body": null,
  "publicView": {
    "schemaVersion": 1,
    "authenticity": "not_verified",
    "items": [],
    "withheldNames": 0,
    "truncatedItems": 0,
    "unsupportedKinds": 0
  },
  "capture": {
    "schemaVersion": 1,
    "ruleId": "mimoto-wallet-credential",
    "why": "Browser requests a wallet-scoped credential through Mimoto; downstream Certify and wallet storage are not visible.",
    "redactionCount": 1,
    "timingKnown": true,
    "observedAt": "2026-10-24T21:32:37.919Z",
    "provenance": "operator_browser_har_metadata",
    "payloadCaptured": false,
    "downstreamCertifyObserved": false,
    "downstreamVerifyObserved": false
  }
}
```

Response:
```json
{
  "source": "live_bridge",
  "headers": {},
  "body": null,
  "publicView": {
    "schemaVersion": 1,
    "authenticity": "not_verified",
    "items": [],
    "withheldNames": 0,
    "truncatedItems": 0,
    "unsupportedKinds": 0
  }
}
```

Redactions: `$.url.path`

### 3. POST https://injiverify.collab.mosip.net/v1/verify/v2/vp-request

**playground → inji_verify · HTTP 201 · 244 ms**

Request:
```json
{
  "clientId": "decentralized_identifier:did:web:injiverify.collab.mosip.net:v1:verify",
  "nonce": "[REDACTED]",
  "dcqlQuery": {
    "credentials": [
      {
        "id": "credential",
        "format": "ldp_vc",
        "meta": {
          "type_values": [
            [
              "https://inji.github.io/inji-config/contexts/[REDACTED]"
            ]
          ]
        }
      }
    ]
  },
  "responseCodeValidationRequired": false
}
```

Response:
```json
{
  "requestUriIssued": true,
  "requestIdIssued": true,
  "transactionIdIssued": true
}
```

Redactions: `$.nonce`, `$.dcqlQuery.credentials[0].meta.type_values[0][0].path`, `$.dcqlQuery.credentials[0].meta.type_values[0][0].fragment`

### 4. GET https://injiverify.collab.mosip.net/v1/verify/v2/vp-request/[REDACTED]

**inji_web_assisted → inji_verify · HTTP 200 · 90 ms**

Request:
```json
{
  "accept": "application/oauth-authz-req+jwt"
}
```

Response:
```json
{
  "signedRequestReceived": true,
  "responseMode": "direct_post"
}
```

Redactions: `$.url.path`

### 5. POST https://injiweb.collab.mosip.net/v1/mimoto/wallets/{id}/presentations

**browser → mimoto · HTTP 200 · 2418 ms**

Request:
```json
{
  "source": "live_bridge",
  "headers": {},
  "body": null,
  "publicView": {
    "schemaVersion": 1,
    "authenticity": "not_verified",
    "items": [],
    "withheldNames": 0,
    "truncatedItems": 0,
    "unsupportedKinds": 0
  },
  "capture": {
    "schemaVersion": 1,
    "ruleId": "mimoto-wallet-presentation",
    "why": "Browser asks Mimoto to present; downstream Verify submission is not visible.",
    "redactionCount": 1,
    "timingKnown": true,
    "observedAt": "2026-10-24T21:33:36.115Z",
    "provenance": "operator_browser_har_metadata",
    "payloadCaptured": false,
    "downstreamCertifyObserved": false,
    "downstreamVerifyObserved": false,
    "requestUriTag": "[REDACTED hmac:7d95241b3c31ddd2]",
    "requestUriSource": "same_origin_referrer"
  }
}
```

Response:
```json
{
  "source": "live_bridge",
  "headers": {},
  "body": null,
  "publicView": {
    "schemaVersion": 1,
    "authenticity": "not_verified",
    "items": [],
    "withheldNames": 0,
    "truncatedItems": 0,
    "unsupportedKinds": 0
  }
}
```

Redactions: `$.url.path`, `$.request.capture.requestUri`

### 6. GET https://injiverify.collab.mosip.net/v1/verify/vp-request/[REDACTED]/status

**playground → inji_verify · HTTP 200 · 107 ms**

Request:
```json
{}
```

Response:
```json
{
  "status": "VP_SUBMITTED"
}
```

Redactions: `$.url.path`

### 7. POST https://injiverify.collab.mosip.net/v1/verify/v2/vp-results/[REDACTED]

**playground → inji_verify · HTTP 200 · 1994 ms**

Request:
```json
{
  "includeClaims": false,
  "skipStatusChecks": true
}
```

Response:
```json
{
  "allChecksSuccessful": true,
  "credentialChecksSuccessful": true,
  "credentialProofValid": true,
  "holderProofValid": true
}
```

Redactions: `$.url.path`

## Related manual wallet observations

These observations are not evidence for this run or its outcome; credential/profile matching has not been established.

# Observed real-wallet compatibility

Manual evidence applies only to the recorded credential and deployment. It does not change managed-run outcomes or evidence tiers.

## Inji Web (real wallet) · Land Registry Registration Receipt

- Evidence ID: a1-web-land-registry-2026-10-23
- Record kind: manual_wallet_observation
- Observed: 2026-10-23
- Format: ldp_vc
- Outcome: valid (verifier_ui)
- Deployment: Hosted Collab Inji Web/Mimoto and Verify; exact Land Registry issuer endpoint unreported
- Versions (issuer / wallet / verifier): unreported / unreported / unreported
- Managed run ID: none
- Managed validation: pending
- Review: pending_integrator_review

### Checkpoints

- Issuance: observed. Credential appeared in the dedicated signed-in wallet.
- Persistent storage: observed. Registration Receipt remained in Stored Cards after a full page refresh.
- Presentation: observed. The same wallet matched the Land Registry request, obtained consent and reported Credentials Shared.
- Verifier acceptance: observed. Inji Verify displayed Registration Receipt Credential — Valid.

### Limits

- Manual browser journey; no playground run or correlated Exchange chain.
- Exact issuer configuration, deployment versions and protocol profile remain unreported.
- A1 integrator sign-off and managed live validation remain pending; no general JSON-LD conformance claim.

### Source artifacts

- [A1 evidence and checklist](https://github.com/oki-dokii/mosip/blob/1537c55287ccbbf9ed9edd113ce2c46fc05c6681/submission/A1_WEB_EVIDENCE.md)
- [Stored cards after refresh](https://github.com/oki-dokii/mosip/blob/1537c55287ccbbf9ed9edd113ce2c46fc05c6681/submission/evidence/person2/live-stored-cards-after-refresh.png)
- [Verify Valid screenshot](https://github.com/oki-dokii/mosip/blob/1537c55287ccbbf9ed9edd113ce2c46fc05c6681/submission/evidence/person2/live-verify-valid.png)
- [Observed hosted route limits](https://github.com/oki-dokii/mosip/blob/fab1288306bd52c3b7942468f1dc6f45f2e82987/submission/PERSON2_HOSTED_ROUTE_HANDOFF.md)
