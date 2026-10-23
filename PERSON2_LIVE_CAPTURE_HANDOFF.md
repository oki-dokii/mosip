# Person 2 ↔ capture handoff, 23 October 2026

This handoff starts from `main` at `a638911`, including the capture work changed in `cd090ce`, and adds the form-state correlation fix committed with this file. Person 2's `codex/person-b-phase-1` tip `1537c55` adds a manual hosted Inji Web record: a Land Registry Registration Receipt was stored, remained after refresh, was presented, and Verify displayed **Valid**. That manual result is valuable wallet evidence; it is not yet a playground-managed, captured, correlated run. The Person 2 branch is behind current `main`, so merge only its reviewed new commit(s), not a wholesale branch replacement.

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
3. Import a reviewed, filtered **synthetic** HAR wrapper to `POST /api/v1/runs/:id/capture/har` while the session is active. The wrapper's `runId` must equal the URL ID. The importer accepts up to 100 entries / 2 MiB per request, allows only configured origins, redacts before persistence, and emits an `exchange:recorded` summary with no body. It returns `imported`, `skippedReasons`, `coverage` and global capture gaps. Multiple batches can be imported in order.
4. The assisted source reads persisted exchanges for that run, replays a snapshot and polls every 50 ms. The driver accepts only a matching `har_import` exchange in the expected step with a 2xx `POST`. Live issuance currently requires `actorTo: certify` and `ruleId: certify-credential`; live presentation requires `actorTo: verify`, `ruleId: verify-submit`, a later sequence number and a matching request state tag. Socket.IO is for the UI, not the driver's source of truth.
5. After the actual card persists in Inji Web, send `POST /api/v1/assisted/runs/:id/observations` with `{ "kind": "storage" }`. This is an explicit human wallet confirmation tied to the observed issuance exchange; HAR alone cannot prove storage. `issuance` and `presentation` observations are fixture-only and return an error in live mode. The verifier result is obtained separately by the verifier driver.

The default allowlist includes Collab Inji Web/Mimoto, several Certify hosts, eSignet and Verify. `CAPTURE_ORIGINS_JSON` can add exact HTTPS origins (or HTTP loopback for local synthetic tests). The standalone `pnpm capture:filter` runs locally, removes unrelated traffic, splits large synthetic HARs, and never uploads the raw source. Keep credentials, cookies, tokens, VCs and raw real-session HAR out of this handoff and repository.

## Correlation and readiness

The verifier adapter retains the signed request's raw `state` only in process memory. It computes an HMAC marker with `runCorrelationKey(runId)` and expects the imported `request.body.state` to equal that marker. The process master key is random and memory-only. A long JSON `state` in a raw entry sanitized **inside the same BFF process** can produce the matching marker; ordinary short states fail closed.

**The current standalone filter cannot preserve this match.** It starts another process with a different random master key; its redacted marker is not the BFF marker, and the BFF re-sanitizes the filtered content. The backend importer now HMAC-tags a long `state` in either JSON or form-encoded direct-post bodies when sanitization happens in its own process; a regression test checks that both paths produce the same tag and different runs do not. Short states still fail closed. Do not share/export the HMAC key, treat a 2xx submission as a correlated presentation, or upload a real-session raw HAR to bypass the remaining gap.

**Readiness: yes for a joint synthetic capture/fixture smoke; no for an end-to-end live playground acceptance test yet.** Before the latter, the capture and assisted owners need a reviewed same-process, pre-storage sanitization bridge for the real browser observation, or another design that produces the backend's run-scoped tag without exposing its key. Confirm the hosted issuance and direct-post URLs against the ordered rule table; Mimoto download traffic alone does not satisfy the current Certify-only issuance predicate. Extend the regression through persisted rows, API responses and Socket.IO summaries, proving that neither state nor credential appears. Then perform the live run and record its IDs and Verify result. Person 2's manual Valid journey remains independent evidence until this chain succeeds.
