# Interoperability run f5f56b45-3160-49b3-96ff-e1238c412fb1

- Status: **passed**
- Expected outcome: **valid**
- Actual outcome: **valid**
- Reason evaluation: **correct_acceptance**
- Protocol profile: `local-jsonld-pex-0.18.2`
- Issuer representation: `unreported`
- Scenario: `custom`
- Expected rejection: `none` at `PRESENT_RESULT`
- Observed rejection: `unknown` at `PRESENT_RESULT`
- Evidence: **Wallet evidence unverified**
- Deployment: **local synthetic profile with observed server hops**
- Boundary: Synthetic IAR authorization fixture
- Boundary: Declared issuer DID assertionMethod adapter
- Boundary: Public JSON-LD contexts require network
- Boundary: Storage confirmation is backed by the separate exact-card browser check
- Boundary: Generic evidence tier remains unverified until team review; this is not conformance certification
- Issuer: `inji_certify`
- Wallet: `inji_web_assisted`
- Verifier: `inji_verify`
- Format: `ldp_vc`
- Tamper: `none`
- Issuer version: `0.14.0`
- Wallet version: `0.17.0`
- Verifier version: `0.18.2`

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

### 1. GET http://127.0.0.1:18090/v1/certify/.well-known/openid-credential-issuer

**playground → inji_certify · HTTP 200 · 0 ms**

Request:
```json
{
  "bodyStored": false
}
```

Response:
```json
{
  "credentialFormat": "ldp_vc",
  "metadataAvailable": true
}
```

Redactions: none

### 2. GET http://127.0.0.1:18090/.well-known/{metadata}

**mimoto → certify · HTTP 200 · 173 ms**

Request:
```json
{
  "body": {},
  "source": "local_server_proxy",
  "capture": {
    "via": "local_issuer_bridge",
    "ruleId": "certify-metadata",
    "observedAt": "2026-10-26T05:07:03.243Z",
    "provenance": "canonical_local_forwarder",
    "correlation": "exclusive_run_lease",
    "schemaVersion": 1,
    "payloadCaptured": false,
    "downstreamVerifyObserved": false,
    "downstreamCertifyObserved": true
  },
  "publicView": {
    "items": [],
    "authenticity": "not_verified",
    "schemaVersion": 1,
    "withheldNames": 0,
    "truncatedItems": 0,
    "unsupportedKinds": 0
  }
}
```

Response:
```json
{
  "source": "local_server_proxy",
  "publicView": {
    "items": [
      {
        "kind": "verifiable_credential",
        "summary": {
          "types": [
            "FarmerCredential",
            "VerifiableCredential"
          ],
          "subject": {
            "names": [
              "fullName",
              "farmerID"
            ],
            "paths": [
              "$.credentialSubject.fullName",
              "$.credentialSubject.farmerID"
            ],
            "withheldNames": 4,
            "truncatedItems": 0
          },
          "proofTypes": []
        }
      }
    ],
    "authenticity": "not_verified",
    "schemaVersion": 1,
    "withheldNames": 4,
    "truncatedItems": 0,
    "unsupportedKinds": 0
  }
}
```

Redactions: `$.request.headers`, `$.request.body`, `$.response.headers`, `$.response.body`, `$.url.path`

### 3. POST http://127.0.0.1:18090/token

**mimoto → certify · HTTP 200 · 684 ms**

Request:
```json
{
  "body": {},
  "source": "local_server_proxy",
  "capture": {
    "via": "local_issuer_bridge",
    "ruleId": "certify-token",
    "observedAt": "2026-10-26T05:07:04.556Z",
    "provenance": "canonical_local_forwarder",
    "correlation": "exclusive_run_lease",
    "schemaVersion": 1,
    "payloadCaptured": false,
    "downstreamVerifyObserved": false,
    "downstreamCertifyObserved": true
  },
  "publicView": {
    "items": [],
    "authenticity": "not_verified",
    "schemaVersion": 1,
    "withheldNames": 0,
    "truncatedItems": 0,
    "unsupportedKinds": 0
  }
}
```

Response:
```json
{
  "source": "local_server_proxy",
  "publicView": {
    "items": [],
    "authenticity": "not_verified",
    "schemaVersion": 1,
    "withheldNames": 0,
    "truncatedItems": 0,
    "unsupportedKinds": 0
  }
}
```

Redactions: `$.request.headers`, `$.request.body`, `$.response.headers`, `$.response.body`, `$.url.path`

### 4. POST http://127.0.0.1:18090/credential

**mimoto → certify · HTTP 200 · 13247 ms**

Request:
```json
{
  "body": {},
  "source": "local_server_proxy",
  "capture": {
    "via": "local_issuer_bridge",
    "ruleId": "certify-credential",
    "observedAt": "2026-10-26T05:07:05.612Z",
    "provenance": "canonical_local_forwarder",
    "correlation": "exclusive_run_lease",
    "schemaVersion": 1,
    "payloadCaptured": false,
    "downstreamVerifyObserved": false,
    "downstreamCertifyObserved": true
  },
  "publicView": {
    "items": [
      {
        "kind": "verifiable_credential",
        "summary": {
          "types": [
            "FarmerCredential",
            "VerifiableCredential"
          ],
          "subject": {
            "names": [],
            "paths": [],
            "withheldNames": 0,
            "truncatedItems": 0
          },
          "proofTypes": []
        }
      }
    ],
    "authenticity": "not_verified",
    "schemaVersion": 1,
    "withheldNames": 0,
    "truncatedItems": 0,
    "unsupportedKinds": 0
  }
}
```

Response:
```json
{
  "source": "local_server_proxy",
  "publicView": {
    "items": [
      {
        "kind": "verifiable_credential",
        "summary": {
          "types": [
            "VerifiableCredential",
            "FarmerCredential"
          ],
          "subject": {
            "names": [
              "farmerID",
              "fullName",
              "id"
            ],
            "paths": [
              "$.credentialSubject.farmerID",
              "$.credentialSubject.fullName",
              "$.credentialSubject.id"
            ],
            "withheldNames": 0,
            "truncatedItems": 0
          },
          "proofTypes": [
            "Ed25519Signature2020"
          ]
        }
      }
    ],
    "authenticity": "not_verified",
    "schemaVersion": 1,
    "withheldNames": 0,
    "truncatedItems": 0,
    "unsupportedKinds": 0
  }
}
```

Redactions: `$.request.headers`, `$.request.body`, `$.response.headers`, `$.response.body`, `$.url.path`

### 5. POST http://127.0.0.1:18081/v1/verify/vp-request

**playground → inji_verify · HTTP 201 · 894 ms**

Request:
```json
{
  "bodyStored": false,
  "protocolProfile": "local-jsonld-pex-0.18.2"
}
```

Response:
```json
{
  "bodyStored": false,
  "requestUriIssued": true
}
```

Redactions: none

### 6. GET http://127.0.0.1:18081/v1/verify/vp-request/[REDACTED]

**playground → inji_verify · HTTP 200 · 193 ms**

Request:
```json
{
  "bodyStored": false,
  "protocolProfile": "local-jsonld-pex-0.18.2"
}
```

Response:
```json
{
  "bodyStored": false,
  "signedRequestReceived": true
}
```

Redactions: `$.url.path`

### 7. POST https://local.test/direct-post/{id}

**mimoto → verify · HTTP 200 · 196 ms**

Request:
```json
{
  "body": {
    "state": "[REDACTED hmac:804f56b03d40468d]"
  },
  "source": "local_server_proxy",
  "capture": {
    "via": "local_issuer_bridge",
    "ruleId": "verify-submit",
    "observedAt": "2026-10-26T05:07:38.348Z",
    "provenance": "canonical_local_forwarder",
    "correlation": "exclusive_run_lease",
    "schemaVersion": 1,
    "payloadCaptured": false,
    "downstreamVerifyObserved": true,
    "downstreamCertifyObserved": false
  },
  "publicView": {
    "items": [
      {
        "kind": "presentation",
        "summary": {
          "tokenPresent": true
        }
      }
    ],
    "authenticity": "not_verified",
    "schemaVersion": 1,
    "withheldNames": 0,
    "truncatedItems": 0,
    "unsupportedKinds": 0
  }
}
```

Response:
```json
{
  "source": "local_server_proxy",
  "publicView": {
    "items": [],
    "authenticity": "not_verified",
    "schemaVersion": 1,
    "withheldNames": 0,
    "truncatedItems": 0,
    "unsupportedKinds": 0
  }
}
```

Redactions: `$.request.headers`, `$.request.body`, `$.response.headers`, `$.response.body`, `$.url.path`

### 8. POST http://127.0.0.1:18081/v1/verify/v2/vp-results/[REDACTED]

**playground → inji_verify · HTTP 200 · 6467 ms**

Request:
```json
{
  "bodyStored": false,
  "protocolProfile": "local-jsonld-pex-0.18.2"
}
```

Response:
```json
{
  "outcome": "valid",
  "resultSource": "independent_verify_poll",
  "statusChecks": "skipped",
  "protocolProfile": "local-jsonld-pex-0.18.2",
  "holderProofValid": true,
  "allChecksSuccessful": true,
  "credentialProofValid": true
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


