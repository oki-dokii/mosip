# Passive browser protocol capture

The capture path accepts a filtered, synthetic browser HAR after a run finishes. It never proxies or rewrites an issuer URL, request URI, signed request object, audience, redirect, or request body. A transparent proxy would need TLS interception or URL rewriting for cross-origin Inji traffic, which could invalidate signed protocol values and change wallet behavior. Passive import preserves the original flow; the playground only reads the exported evidence afterward.

`POST /api/v1/runs/:id/capture/har` accepts JSON `{ "runId": "<same id>", "har": { "log": { "entries": [...] } } }`. Export browser Network traffic as HAR, filter it to the intended protocol calls, and use synthetic identities only. The run must already be finished. The request limit is 2 MiB and 100 entries; each body is capped at 128 KiB. A run-id mismatch, malformed HAR, or any entry from an unapproved origin rejects the import. Re-importing identical entries skips them.

The default origin allowlist covers the Collab Inji Web/Mimoto, Certify, eSignet, and Verify hosts. For a local synthetic stack, set `CAPTURE_ORIGINS_JSON` on the BFF to a JSON object mapping exact origins to `mimoto`, `certify`, `esignet`, or `verify`, for example `{"http://127.0.0.1:9001":"certify"}`. Only HTTPS origins and HTTP loopback origins are accepted. This configuration does not cause the BFF to fetch those URLs.

Entries are ordered by `startedDateTime` before assigning exchange sequence numbers. HAR `time: -1` is accepted as unknown and represented as `durationMs: 0`; do not interpret that as a measured zero-duration request. A JSON body marked `encoding: "base64"` is decoded within the same 128 KiB cap and then redacted. Malformed base64 or malformed JSON is represented by a redaction marker. An invalid entry or untrusted origin still rejects the import; partial imports of malformed HAR files are not implemented.

Recognized protocol paths map to the existing run steps. Unknown paths on an allowlisted origin are skipped. The response gives `imported`, `skipped`, and a capture-gap note. Open the run inspector or `GET /api/v1/runs/:id/exchanges` to see the resulting exchanges. Imported exchanges have `request.source` and `response.source` set to `har_import`; they do not change the run outcome or prove that a wallet stored a credential.

Before storage or Socket.IO emission, the importer replaces path identifiers with route templates, masks every query value, keeps only safe MIME header metadata, masks auth/cookie headers, and keeps only the shape of JSON/form bodies. Protocol enum values from a short allowlist may remain; all other scalar values are masked. The original HAR is never persisted. Parse failures return stable error codes without echoing input.

Browser HAR can miss server-to-server Certify/eSignet calls, native-wallet traffic, encrypted exchanges, and requests outside the browser's recording window. Record those as gaps; do not label a HAR as complete end-to-end evidence. Live Inji Web capture and wallet proof remain integration checks with the real-wallet workstream.

## Person 1 synthetic handoff (22 October 2026)

The committed [four-service synthetic HAR](apps/bff/src/capture/fixtures/four-service.synthetic.har.json) contains browser-shaped Mimoto, Certify, eSignet, and Verify calls plus one static asset that the importer skips. It uses `.example` origins, synthetic canary values, and a fixed run ID. No real credential, account, or session traffic is in this fixture. The [saved import result](apps/bff/src/capture/fixtures/four-service.import-result.json) lists the four deterministic exchange IDs and their step mapping; the test verifies it against a fresh import. The result's evidence tier is `synthetic_browser_har`, and `liveInjiWebObserved` is `false`.

| Browser-visible step | Fixture service | Saved exchange ID | What the HAR proves |
| --- | --- | --- | --- |
| `ISSUE_OFFER` | Mimoto | `87a5f642-1077-4c04-ae5f-b6e9f249bd8c` | A synthetic issuer-list HTTP exchange was mapped. |
| `ISSUE_CREDENTIAL` | Certify | `ff6143cd-617e-4755-a301-264e95ef8fbc` | A synthetic credential endpoint exchange was mapped; possession is not established. |
| `ISSUE_TOKEN` | eSignet | `82298e44-daa5-4cd4-acfb-33aa2b8f90e3` | A synthetic browser authorization call was mapped. |
| `PRESENT_REQUEST` | Verify | `0f1e3e86-e978-4ff7-ace6-e6208c26ea31` | A synthetic request-fetch exchange was mapped; submission and validation are not observed. |

The fixture does **not** cover `STORE`, `PRESENT_SUBMIT`, `PRESENT_STATUS`, or `PRESENT_RESULT`. Even when those browser calls appear in another HAR, the capture can only prove what the browser sent and received. It cannot see server-to-server Certify/eSignet requests, wallet-local storage or cryptographic operations, native-wallet app traffic, response content encrypted for another party, or calls made before recording began or after it ended. A browser may also omit response bodies from its HAR export. These are evidence boundaries, not failed protocol steps.

The redaction tests assert separate handling for authorization and cookie headers, URL query and path values, JSON and form fields, nested JWK values, malformed JSON/base64 and HAR input, stored rows, the inspector API, and Socket.IO summaries. The shared exchange redactor also masks common token-name variants, private RSA JWK parameters, bearer strings, compact JWTs, and private PEM strings. The source HAR is never stored. The PostgreSQL test runs only when `CAPTURE_POSTGRES_TEST_URL` points to a disposable local database; it creates one run, inspects the raw exchange rows, and deletes that run afterward.

```sh
pnpm --filter @playground/bff exec vitest run src/capture/har.test.ts
CAPTURE_POSTGRES_TEST_URL='postgresql://playground:playground@127.0.0.1:55433/playground?schema=public' \
  pnpm --filter @playground/bff exec vitest run src/capture/har.test.ts
```

On 22 October 2026, the targeted suite passed locally with PostgreSQL (`8 tests passed`) and without it (`7 passed, 1 skipped`). The API test emitted four Socket.IO summaries and read four exchanges through the inspector endpoint without any fixture canary. This is synthetic capture proof only. The live Inji Web case remains **unobserved** until the real-wallet workstream supplies traffic and a corresponding verifier result.
