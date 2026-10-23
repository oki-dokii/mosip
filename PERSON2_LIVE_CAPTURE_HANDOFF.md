# Person 2 ↔ capture handoff, 23 October 2026

This handoff started at `55f77ff` and now includes the bounded live bridge. Person 2's `codex/person-b-phase-1` tip `1537c55` adds a manual hosted Inji Web record: a Land Registry Registration Receipt was stored, remained after refresh, was presented, and Verify displayed **Valid**. That manual result is valuable wallet evidence; it is not yet a playground-managed, captured, correlated run. Merge only the reviewed new Person 2 commit(s) from that branch, not a wholesale branch replacement.

## Frozen `Exchange` contract and attribution

The shared `Exchange` fields are `id`, `runId`, `stepId`, `seq`, `actorFrom`, `actorTo`, `method`, `url`, `status`, `durationMs`, `request`, `response`, and `redactions`. Capture metadata is inside `request.capture`; `source` is inside both request and response. No shared type or database migration is needed.

The following two objects are **synthetic shape examples**, not evidence from the hosted session. IDs and HMAC text are illustrative. They show what the inspector receives after the backend has sanitized a recognized HAR entry:

```json
[
  {
    "id": "11111111-2222-4333-a444-555555555555",
    "runId": "aaaaaaaa-bbbb-4ccc-addd-eeeeeeeeeeee",
    "stepId": "11111111-aaaa-4bbb-accc-222222222222",
    "seq": 4,
    "actorFrom": "browser",
    "actorTo": "certify",
    "method": "POST",
    "url": "https://injicertify.collab.mosip.net/credential",
    "status": 200,
    "durationMs": 53,
    "request": {
      "source": "har_import",
      "headers": { "content-type": "application/json", "authorization": "[REDACTED]" },
      "body": { "format": "ldp_vc", "proof": { "jwt": "[REDACTED]" } },
      "capture": { "schemaVersion": 1, "ruleId": "certify-credential", "why": "POST to the explicit credential endpoint requests issuance.", "redactionCount": 3, "timingKnown": true, "observedAt": "2026-10-23T10:00:00.000Z" }
    },
    "response": { "source": "har_import", "headers": {}, "body": { "credential": "[REDACTED]" } },
    "redactions": ["$.request.headers.authorization", "$.request.body.proof.jwt", "$.response.body.credential"]
  },
  {
    "id": "66666666-7777-4888-a999-000000000000",
    "runId": "aaaaaaaa-bbbb-4ccc-addd-eeeeeeeeeeee",
    "stepId": "33333333-aaaa-4bbb-accc-444444444444",
    "seq": 9,
    "actorFrom": "browser",
    "actorTo": "verify",
    "method": "POST",
    "url": "https://injiverify.collab.mosip.net/direct-post/{id}",
    "status": 200,
    "durationMs": 68,
    "request": {
      "source": "har_import",
      "headers": { "content-type": "application/json" },
      "body": { "state": "[REDACTED hmac:0123456789abcdef]", "vp_token": "[REDACTED]" },
      "capture": { "schemaVersion": 1, "ruleId": "verify-submit", "why": "Explicit direct-post endpoint receives a presentation.", "redactionCount": 2, "timingKnown": true, "observedAt": "2026-10-23T10:01:00.000Z" }
    },
    "response": { "source": "har_import", "headers": {}, "body": { "status": "valid" } },
    "redactions": ["$.request.body.state", "$.request.body.vp_token"]
  }
]
```

The actual importer derives `redactionCount` from distinct redaction paths and can add optional `publicView` to either envelope; the example deliberately omits that projection. It does not establish that Verify returned `valid`. The capture of a 2xx direct-post is transport evidence; the verifier driver must obtain its own result.

`POST /api/v1/assisted/runs` allocates a fresh UUID for `runId` and `createSteps` allocates independent UUIDs for every step. Read the returned run ID, then `GET /api/v1/assisted/runs/:id` to obtain the `ISSUE_CREDENTIAL` and `PRESENT_SUBMIT` step IDs. The importer chooses a step from its ordered route table, sets `actorFrom = browser`, maps the exact URL origin to `actorTo = mimoto | certify | esignet | verify`, and stores the matched `ruleId`. It calculates each exchange ID from run ID plus sanitized public HTTP metadata and occurrence; `seq` is allocated under the exchange lock. Neither the browser nor Person 2 should supply exchange or step IDs in the HAR. Unrecognized routes remain `untagged`; there is no guessed attribution. The committed [synthetic four-service fixture](apps/bff/src/capture/fixtures/four-service.synthetic.har.json) and [saved result](apps/bff/src/capture/fixtures/four-service.import-result.json) give reproducible real importer IDs.

## How observations reach the live driver

1. Configure the live assisted endpoints listed in [Person 2's handoff](submission/PERSON_B_PHASE2_HANDOFF.md), including exact canonical capture origins. `GET /api/v1/assisted/capabilities` reports whether the configuration is present; it does not prove interoperability.
2. Start the managed run with `POST /api/v1/assisted/runs` using `mode: "live"`, JSON-LD, Inji Certify, Inji Web assisted, Inji Verify, cross-device and no tamper. Its default timeout is 60 seconds per waiting step; use a bounded larger `timeoutMs` (maximum 300000) for a human journey.
3. Synthetic HAR wrappers can still be imported to `POST /api/v1/runs/:id/capture/har` for fixture checks. For a **real** session, use the local metadata-only discovery and bridge commands below; never upload its raw HAR. The bridge sends only bounded transport metadata plus the opaque Verify state, and the BFF redacts before persistence or Socket.IO emission.
4. The assisted source reads persisted exchanges for that run, replays a snapshot and polls every 50 ms. A browser Certify credential POST is direct issuance transport evidence. A live bridge Mimoto download or wallet-scoped credential POST is browser-to-Mimoto transport evidence only; its saved metadata says downstream Certify was **not** observed. Live presentation accepts either a Verify direct-post with a matching state tag, or a wallet-scoped Mimoto presentation POST with a matching Verify request-URI tag. Both require the correct actor/rule, a later sequence number, and the configured origin. Mimoto transport explicitly leaves downstream Verify unobserved. Socket.IO is for the UI, not the driver's source of truth.
5. After the actual card persists in Inji Web, send `POST /api/v1/assisted/runs/:id/observations` with `{ "kind": "storage" }`. This is an explicit human wallet confirmation tied to the observed issuance exchange; HAR alone cannot prove storage. `issuance` and `presentation` observations are fixture-only and return an error in live mode. The verifier result is obtained separately by the verifier driver.

The default allowlist includes Collab Inji Web/Mimoto, several Certify hosts, eSignet and Verify. `CAPTURE_ORIGINS_JSON` can add exact HTTPS origins (or HTTP loopback for local synthetic tests). The standalone `pnpm capture:filter` runs locally, removes unrelated traffic, splits large synthetic HARs, and never uploads the raw source. Keep credentials, cookies, tokens, VCs and raw real-session HAR out of this handoff and repository.

## Correlation and readiness

The verifier adapter retains the signed request's raw `state` only in process memory. It computes an HMAC marker with `runCorrelationKey(runId)` and expects the imported `request.body.state` to equal that marker. The process master key is random and memory-only. A long JSON `state` in a raw entry sanitized **inside the same BFF process** can produce the matching marker; ordinary short states fail closed.

**The standalone synthetic HAR filter cannot preserve this match.** It starts another process with a different random master key. For a real assisted run, the new bridge sends only the transient `state` scalar alongside allowlisted transport metadata to the BFF, which computes the marker in the same process as the verifier adapter. It never exports the HMAC key or uploads the raw HAR. Short states still fail closed. The bridge authorization token is separate from the HMAC key and must remain private.

**Bridge readiness: implemented and synthetic/API-tested. Hosted correlation readiness: pending observation.** Person 2's fresh recording established four actual paths in [the hosted route handoff](submission/PERSON2_HOSTED_ROUTE_HANDOFF.md). The rules now map wallet-scoped Mimoto credential/presentation POSTs and Verify UI session-request/results POSTs. No browser-to-Verify direct-post was observed. The Mimoto presentation POST had no top-level `state`; the collector now checks the same POST's top-level `request_uri`/`requestUri` body field, URL query, or same-origin `/user/authorize` Referer for the exact backend-created Verify request URI. It sends that scalar only transiently to the BFF for a run-scoped HMAC tag. If none is present, the observation is skipped as `request_uri_unavailable`, and the driver cannot advance. A 2xx endpoint call, a submitted observation and a storage confirmation do not independently prove a valid credential; the final verdict must still come from the configured Verify driver. Person 2's manual Valid journey remains independent evidence until the managed run succeeds.

### Joint live run instructions

1. Start the BFF with a fresh private `CAPTURE_BRIDGE_TOKEN` of at least 32 characters, `ASSISTED_LIVE_ENABLED=true`, the canonical Certify/Verify/Web settings and the tested Land Registry offer/profile. The default Verify request still asks for Farmer; set `VERIFY_LDP_TYPE_VALUES_JSON` to include `https://inji.github.io/inji-config/contexts/landregistry-registration-receipt-context.json#RegistrationReceiptCredential` as observed in the hosted request (see `.env.example`). Set the **same bridge authorization token** in the collector shell. It is separate from the BFF's hidden HMAC key; never put either value in Git, screenshots or a command argument. Use the same `CAPTURE_ORIGINS_JSON` on the collector if custom origins are configured. The BFF endpoint may be HTTP only on loopback; use HTTPS otherwise.
2. Start a managed live run with `timeoutMs: 300000`. Clear browser Network history and record only the current journey. Save the HAR temporarily **outside the repository**, never share or upload it. After the issuance interaction, run `pnpm capture:routes /outside-repo/session.har`. Share only the relevant `POST` rows (method, origin, masked path, rule ID) with Person 1. Unknown paths appear with `ruleId: null`; do not guess them.
3. If the issuance rule matches, run `pnpm capture:bridge /outside-repo/session.har RUN_UUID http://127.0.0.1:4000`. The command prints counts and rule IDs only. For the observed wallet-scoped Mimoto credential POST, check that the saved exchange says `actorTo: mimoto`, `ruleId: mimoto-wallet-credential`, `downstreamCertifyObserved: false`. Once the card survives refresh, confirm storage through the assisted UI/API; this is a separate human assertion.
4. Launch the backend-created verifier request through the tested Inji Web URL. Export the current Network recording again, run `capture:routes`, then rerun `capture:bridge` while the assisted run is active. Earlier entries deduplicate. The wallet-scoped Mimoto presentation must have `ruleId: mimoto-wallet-presentation` and a request-URI HMAC matching the backend-created request; `downstreamVerifyObserved` remains false. If `skippedReasons.request_uri_unavailable` increments, inspect **only whether** that same POST contains a top-level request URI, query request URI, or a same-origin authorize Referer, and report that boolean/source without its value. Do not substitute timing-only correlation. The collector never sends `vp_token`. The verifier driver must produce its own normalized result. Browser Verify session-result traffic is context only, not that verdict.
5. Record the run, step and exchange IDs, origin/path rule hits, browser coverage and missing/not-observable boundaries. Review database/API/Socket.IO/report output for leakage; only then request A1 sign-off. Remove the temporary local HAR after review.

The bridge is a **trusted operator observation**, not a cryptographically authenticated browser recording: a holder of the private bridge token could submit fabricated metadata. Preserve the sanitized UI evidence and Verify's independent result as separate checks. Server-to-server Mimoto → Certify traffic is outside browser coverage unless it is instrumented at the service boundary.
