# Passive browser protocol capture

The capture path accepts a filtered, synthetic browser HAR after a run finishes, or while a managed assisted run is active. It reads evidence without changing issuer URLs, request URIs, signed objects, audiences, redirects or request bodies. A canonical-URL proxy on a controlled local stack is also a valid design option when all service metadata and signed values use that origin from the beginning; see [the proxy ADR](CAPTURE_PROXY_ADR.md). HAR remains the implemented browser path for Collab. The [Person 2 live-capture handoff](PERSON2_LIVE_CAPTURE_HANDOFF.md) records the current correlation limit.

`POST /api/v1/runs/:id/capture/har` accepts JSON `{ "runId": "<same id>", "har": { "log": { "entries": [...] } } }`. Export browser Network traffic as HAR and use synthetic identities only. **Run the local filter before upload**: the importer rejects a whole import containing any structurally valid off-allowlist origin, whereas the filter removes and counts unrelated background calls. Ordinary runs must already be finished; a managed active assisted run may import while its session is active. The request limit is 2 MiB and 100 entries; each body is capped at 128 KiB. A run-id mismatch, malformed top-level HAR, or a structurally valid entry from an unapproved origin rejects the import. Malformed individual entries are skipped with counted reasons. Re-importing identical entries skips them.

The default origin allowlist covers the Collab Inji Web/Mimoto, Certify, eSignet, and Verify hosts. For a local synthetic stack, set `CAPTURE_ORIGINS_JSON` on the BFF to a JSON object mapping exact origins to `mimoto`, `certify`, `esignet`, or `verify`, for example `{"http://127.0.0.1:9001":"certify"}`. Only HTTPS origins and HTTP loopback origins are accepted. This configuration does not cause the BFF to fetch those URLs.

Entries are ordered by `startedDateTime` before assigning exchange sequence numbers. HAR `time: -1` is accepted as unknown and represented as `durationMs: 0`; do not interpret that as a measured zero-duration request. A JSON body marked `encoding: "base64"` is decoded within the same 128 KiB cap and then redacted. Malformed base64 or malformed JSON is represented by a redaction marker. Malformed individual entries and status-zero unfinished requests are skipped with counted reasons. Unsupported origins and oversized recognized bodies remain hard failures, and no exchange is stored until preparation succeeds.

Recognized protocol paths map to the existing run steps. Unknown paths on an allowlisted origin are skipped. The response gives `imported`, `skipped`, `skippedReasons`, per-step `coverage`, and capture `gaps`. Unknown routes increment `untagged`; malformed entries, unfinished requests, duplicates and unsupported methods have separate counts. Open the run inspector or `GET /api/v1/runs/:id/exchanges` to see the resulting exchanges. Imported exchanges have `request.source` and `response.source` set to `har_import`; they do not change the run outcome or prove that a wallet stored a credential.

Before storage or Socket.IO emission, the importer replaces path identifiers with route templates, masks secret query values while retaining only exact allowlisted public protocol enums, keeps only safe MIME header metadata, masks auth/cookie headers, and keeps only the shape of JSON/form bodies. Protocol enum values from a short allowlist may remain; all other scalar values are masked. Unknown body field names become numbered `[field:n]` placeholders so distinct shapes cannot overwrite each other; unknown query names become `[field]`. Arrays/objects truncated at safety limits record counts in redaction paths. The original HAR is never persisted. Parse failures return stable error codes without echoing input.

Browser HAR can miss server-to-server Certify/eSignet calls, native-wallet traffic, encrypted exchanges, and requests outside the browser's recording window. Record those as gaps; do not label a HAR as complete end-to-end evidence. Live Inji Web capture and wallet proof remain integration checks with the real-wallet workstream.

## Person 1 synthetic handoff (22 October 2026)

The committed [four-service synthetic HAR](../apps/bff/src/capture/fixtures/four-service.synthetic.har.json) contains browser-shaped Mimoto, Certify, eSignet, and Verify calls plus one static asset that the importer skips. It uses `.example` origins, synthetic canary values, and a fixed run ID. No real credential, account, or session traffic is in this fixture. The [saved import result](../apps/bff/src/capture/fixtures/four-service.import-result.json) lists the four deterministic exchange IDs and their step mapping; the test verifies it against a fresh import. The result's evidence tier is `synthetic_browser_har`, and `liveInjiWebObserved` is `false`.

| Browser-visible step | Fixture service | Saved exchange ID | What the HAR proves |
| --- | --- | --- | --- |
| `ISSUE_OFFER` | Mimoto | `97c91b0d-8276-4119-a8d1-2fc865fc2beb` | A synthetic issuer-list HTTP exchange was mapped. |
| `ISSUE_CREDENTIAL` | Certify | `d11a0b5e-011a-447e-a01a-a199a0cdc78d` | A synthetic credential endpoint exchange was mapped; possession is not established. |
| `ISSUE_TOKEN` | eSignet | `f4a1ca40-bbc7-494d-a026-b0e36aebe760` | A synthetic browser token exchange was mapped. |
| `PRESENT_REQUEST` | Verify | `f80d1f3b-03e4-4b9d-afaf-63d8e4523c48` | A synthetic request-fetch exchange was mapped; submission and validation are not observed. |

The fixture does **not** cover `STORE`, `PRESENT_SUBMIT`, `PRESENT_STATUS`, or `PRESENT_RESULT`. Even when those browser calls appear in another HAR, the capture can only prove what the browser sent and received. It cannot see server-to-server Certify/eSignet requests, wallet-local storage or cryptographic operations, native-wallet app traffic, response content encrypted for another party, or calls made before recording began or after it ended. A browser may also omit response bodies from its HAR export. These are evidence boundaries, not failed protocol steps.

The redaction tests assert separate handling for authorization and cookie headers, URL query and path values, JSON and form fields, nested JWK values, malformed JSON/base64 and HAR input, stored rows, the inspector API, and Socket.IO summaries. The shared exchange redactor also masks common token-name variants, private RSA JWK parameters, bearer strings, compact JWTs, and private PEM strings. The source HAR is never stored. The PostgreSQL test runs only when `CAPTURE_POSTGRES_TEST_URL` points to a disposable local database; it creates one run, inspects the raw exchange rows, and deletes that run afterward.

```sh
pnpm --filter @playground/bff exec vitest run src/capture/har.test.ts
CAPTURE_POSTGRES_TEST_URL='postgresql://playground:playground@127.0.0.1:55433/playground?schema=public' \
  pnpm --filter @playground/bff exec vitest run src/capture/har.test.ts
```

On 22 October 2026, the HAR suite passed locally with PostgreSQL (`11 tests passed`), including the enriched public-view persistence check, and without it (`10 passed, 1 skipped`). The API test emitted four Socket.IO summaries and read four exchanges through the inspector endpoint without any fixture canary. This is synthetic capture proof only. The live Inji Web case remains **unobserved** until the real-wallet workstream supplies traffic and a corresponding verifier result.

## Public summaries and tagging v2

`Exchange.request.publicView` and `Exchange.response.publicView` are optional JSON members inside the existing request/response envelopes. No shared `Exchange` type or database column changes are required. Each view has `schemaVersion: 1`, `authenticity: "not_verified"`, bounded `items` of `{kind, summary}`, and `withheldNames`, `truncatedItems`, and `unsupportedKinds` counters. The inspector needs a dedicated renderer; [Person 2 handoff](PERSON2_PUBLIC_VIEW_HANDOFF.md) defines its acceptance test.

Supported kinds are credential offers, Presentation Exchange definitions, DCQL, request-object headers/selected claims, proof-JWT headers, SD-JWT claim/disclosure names, JSON-LD VC types/issuer method or allowed origin, claimed verification results, and a presentation-presence marker. Names come from a small fixed vocabulary of protocol claims and demo schemas; unknown names and predicate values are withheld with a count. CBOR/mDoc content is counted as unsupported rather than decoded. Issuer URLs keep only an allowlisted origin, and DIDs keep only the method. No resolver, network fetch or cryptographic verification is performed.

`request.capture` contains the ordered rule ID and its reason, a redaction-path count, the normalized timestamp and `timingKnown`. Rule matching requires service, HTTP method and anchored endpoint patterns. In particular, eSignet login/consent/authorization pages are untagged, and Verify status/result resources precede request-fetch rules. This endpoint map describes the tested deployment shapes, not every Inji release.

`coverage` counts only browser-HAR exchanges for each run step, including earlier imports. Its `projection` member totals withheld names, truncated items and unsupported kinds from saved request/response public views. `captured` means an HTTP call was observed, never that the protocol step passed. `missing` means no matching browser call was recorded and may reflect server-side work or a recording-window gap. Internal `INIT`, wallet-local `STORE`, and `REPORT` are `not_observable` when no HTTP evidence exists. Global capture gaps remain separate. The eSignet fixture now represents an explicit token request; saved IDs use the public-metadata v2 algorithm described in [SECURITY.md](SECURITY.md).

## Local pre-upload filter

Use absolute paths for both files. The source may be a plain HAR or the API wrapper. The command reads at most 32 MiB / 20,000 entries locally, removes unapproved background origins and untagged paths, and applies the same sanitizer. Without `--split`, more than 100 surviving calls fail closed. With `--split`, it writes `.part-001.json`, `.part-002.json`, etc., each with at most 100 calls and its own sanitized report. Review and import the parts in order. Counts of skipped source entries repeat in each part and must not be summed. Keep raw recordings outside the repository and use synthetic identities only.

```sh
# CAPTURE_ORIGINS_JSON can add the exact origins of your synthetic local services.
pnpm capture:filter /absolute/path/synthetic-source.har /absolute/path/safe-import.json RUN_UUID
# Add --split when more than 100 protocol entries survive. Review each numbered part.
# Review safe-import.json locally, then import its runId/har fields:
curl -H 'Content-Type: application/json' --data-binary @/absolute/path/safe-import.json \
  http://127.0.0.1:4000/api/v1/runs/RUN_UUID/capture/har
```

The output includes a safe report with skip counts and public summaries decoded locally. Imported filtered bodies can produce a smaller public projection because private scalar values were already removed; use the report for that additional safe detail. The report itself is not treated as trusted server-decoded evidence. The original trace is never uploaded by this command. Output files use `0600` and cannot overwrite an existing file. A malformed source or unsafe size fails with a codes-only message.

The [22 October check record](../submission/evidence/2026-10-22-capture-checks.json) records the commands and local results, including 46 capture/redaction checks with PostgreSQL.

## Managed live observation bridge

For a real assisted run, use `pnpm capture:routes /outside-repo/session.har` locally to discover only method, allowlisted origin and a path with non-public segments replaced by `{id}`. Query strings, fragments, headers and bodies never appear in this output. The Person 2 handoff has the sequence and provenance rules. `pnpm capture:bridge /outside-repo/session.har RUN_UUID http://127.0.0.1:4000` sends only an allowlisted POST's timestamp, duration, URL without query/fragment, 2xx status and one correlation scalar where required. For Verify direct-post this is `state`; for the observed Mimoto presentation route it is the exact Verify `request_uri` from that **same POST's** top-level `request_uri`/`requestUri` body field, URL query, or same-origin `/user/authorize` Referer. The collector rejects conflicting values and skips a Mimoto presentation with none, counting `request_uri_unavailable`. It never falls back to proximity in time or another HAR entry. The BFF validates the URI against an allowlisted Verify origin and saves only its run-scoped HMAC tag; the URI itself is transient and never persisted. The collector does **not** upload the HAR, credential, VP, cookies, auth headers or response body. A separate private `CAPTURE_BRIDGE_TOKEN` authorizes the collector; it is not the run-scoped HMAC key. The BFF saves only the sanitized `Exchange` and emits a body-free Socket.IO summary. The route requires an active live assisted run, a fresh observation timestamp, and an exact tagged route.

The hosted route rules are `mimoto-wallet-credential` (browser → Mimoto issuance transport), `mimoto-wallet-presentation` (browser → Mimoto presentation transport), `verify-session-request` (browser Verify UI request), and `verify-session-results` (browser Verify UI result lookup). The earlier direct `mimoto-download`, Certify credential and Verify direct-post rules remain separate. Mimoto issuance does not expose a possible **Mimoto → Certify** server-side request; `downstreamCertifyObserved` is false. Mimoto presentation does not expose **Mimoto → Verify**; `downstreamVerifyObserved` is false. The Verify UI session-results POST's 2xx transport status is **not** a validity verdict. Wallet storage still needs separate human confirmation, and the final verdict comes only from the playground's independent Verify result driver. The four paths were observed in Person 2's 23 October recording, but whether that deployment supplies the required request URI on the Mimoto POST/Referer remains untested; if absent the managed run stays unverified. Keep the raw HAR outside the repository on a trusted machine, do not share it, and remove it after the review. If the BFF is not on loopback, use HTTPS for the bridge target.

Capture ingress requires JSON and limits attempts to 10 per minute per transport peer. See [SECURITY.md](SECURITY.md) for threat boundaries and private disclosure, and [the integration contract](CAPTURE_CONTRACT_PROPOSAL.md) for the additive API seam and remaining owner handoffs.

## Person 1 regression and evidence tools — 22 October

The requested independent items 1–10 are implemented. Item 11 is handed to Person 3 in [PERSON3_PRESENTATION_PROBES_HANDOFF.md](PERSON3_PRESENTATION_PROBES_HANDOFF.md); the mock verifier and protocol contracts are unchanged by this work.

| Request | Implementation and proof |
| --- | --- |
| Credential value leaks | `capture/fixtures/adversarial.ts` generates a genuinely signed SD-JWT and a structurally complete JSON-LD VC with synthetic claims/proof at runtime. `adversarial.test.ts` verifies the SD-JWT signature before checking the decoder. `har.test.ts` posts both through HTTP into PostgreSQL, then inspects raw exchange rows, repository results, run/inspector/report JSON, Markdown and captured Socket.IO emission arguments. Complete tokens, disclosures, salt, subject values and derived HMAC keys must be absent. The JSON-LD proof is a structural canary, not a cryptographic verification test. |
| Correlation keys | Tests check 32-byte per-run keys, same-run stability, different-run tags, fresh-module key changes and absence of keys in persisted/emitted output. Keys are derived from a cryptographically random process master held in memory. They are not persisted, and tags change after process restart. Long OTPs/codes/private JWK members still use plain masks, including mixed-case keys. |
| Adversarial HAR corpus | Permanent generated specimens cover path/fragment/Location, cookies, error bodies, base64 JSON, gzip bytes, compressed expansion, Cyrillic/fullwidth/invisible key names, 200 levels of nesting, 3,000 fields, and SD-JWT disclosures. Gzip bytes are never inflated; compressed JSON remains an opaque malformed body. HAR-exported decompressed JSON can be inspected normally. |
| Fuzzing | Four recorded PRNG seeds generate 1,000 nested cases with random casing, separators, Unicode variants and array/object depth. Additional tests cover cycles and wide objects. This is reproducible generative testing, not exhaustive fuzzing or a promise to detect arbitrary short secrets under unrelated names. |
| Tagging | The existing table-driven suite exercises all 12 rules independently, wrong methods, status-route precedence and unmatched/login/consent paths. Unknown traffic stays untagged. |
| Endpoint limits | Tests assert exact codes-only errors for wrong content types, malformed JSON, trailing-slash requests, oversized bodies and rate limits, including attempts to bypass the peer limit with forwarded headers. |
| Audit | `scripts/audit-secrets.mjs` scans evidence, fixtures and scripts (including source/test files), plus existing docs and sensitive filenames. Planted-canary tests cover JWTs, private PEM blocks, long base64, email, international phone numbers and token fields. Findings print paths/lines/rules, never matched values. |
| CLI bounds | Subprocess tests drive 500 static assets, unknown time, status zero, missing fields, malformed input and a 33 MiB file. Commands have test deadlines, counted skip reasons, owner-only new files and overwrite protection. |
| Drift/export | `scripts/evidence-tools.mjs` and its Node tests compare October 21 evidence and the Collab contract fixture; issue drafts include versions, steps, expected/actual and sanitized shapes. |

Socket.IO tests observe the actual arguments passed to `emit` through a test double; they do not claim browser/client transport E2E coverage. PostgreSQL tests require `CAPTURE_POSTGRES_TEST_URL` and otherwise skip explicitly. Hosted CI currently runs the remaining tests through `pnpm test`; Person 4 owns enabling PostgreSQL tests and the audit command in CI.

### Commands

Run from the repository root. Output paths must be new files. These tools do not contact Collab, file issues or modify another person's runtime code.

```sh
node scripts/evidence-tools.mjs drift \
  submission/evidence/2026-10-21-mock-x509-valid.json \
  submission/evidence/2026-10-21-mock-x509-bad-signature.json \
  /tmp/playground-shape-diff.json

node scripts/evidence-tools.mjs issue \
  submission/evidence/2026-10-21-mock-x509-valid.json \
  /tmp/playground-issue-draft.md

node --test scripts/audit-secrets.test.mjs scripts/evidence-tools.test.mjs
pnpm --filter @playground/bff exec vitest run src/capture src/redaction.test.ts src/redaction-fuzz.test.ts
# Set CAPTURE_POSTGRES_TEST_URL to a migrated local test database to include both DB tests.
pnpm audit:secrets
```

The exporter reads **HEAD**, not uncommitted working-tree data, and accepts JSON under `submission/evidence/` or `spikes/fixtures/` only. Inputs are capped at 4 MiB; new output files use mode 0600 and cannot overwrite existing files. Output records source commit and SHA-256. Invalid arguments/parser errors return a fixed message without input content.

Run comparison aligns exchanges by step, actors, method and occurrence order, ignoring raw URLs and volatile IDs. Each request/response has a bounded shape map: added/removed fields, primitive type changes and array element type unions. Redacted markers have their own type; unknown field names collapse to `[unknown-field]` to avoid key-name leaks. Truncation is explicit. Reordered repeated requests can misalign; omitted fields, masking and different scenarios can produce differences without an upstream protocol change. Equal shapes do not establish compatibility.

The committed [shape comparison](../submission/evidence/2026-10-22-capture-shape-diff.json) finds that the October 21 bad-signature result omits `holderProofValid` and its submission has string rather than null `tamper`. These are observations of different recorded scenarios, not newly reproduced vulnerabilities. The contract-fixture tests use deliberate in-memory mutations to verify detection; they are not fresh Collab evidence.

Issue output defaults to a **private review draft**, with no automatic filing. It deliberately excludes arbitrary titles, summaries, error prose, URLs, secrets and unknown version strings. Add a reviewed minimal reproducer and check the applicable protocol/version before sharing. Follow `SECURITY.md` for security-impact findings. Runtime keys and generated complete credential canaries are never committed.


## 22 October reviewer follow-up

The driver redactor now masks independent-key canaries for PINs, passwords, API keys, tokens, assertions, transaction/session IDs and refresh variants; their mixed-case forms are covered. It records dropped array/object counts, preserves shared non-cyclic objects, and distinguishes a parsed JWT from a dotted domain. URL/form values remain masked unless they match a **fixed** public enum allowlist for `response_type`, `grant_type`, `scope` or a known synthetic `client_id`. The HAR importer uses the same allowlist. No arbitrary client ID is exposed. Tests exercise each class.

The public decoder still has a deliberately small vocabulary. Its withheld/truncated/unsupported counters and per-step coverage expose omissions; they do not add mDoc CBOR parsing or confirm new MOSIP credential types. The web UI renderer is assigned to Person 2 in [PERSON2_PUBLIC_VIEW_HANDOFF.md](PERSON2_PUBLIC_VIEW_HANDOFF.md).

## Canonical local server-hop capture (26 October)

The forwarding prototype is now integrated for the pinned synthetic JSON-LD local
profile. See [the implemented contract and commands](PERSON1_LOCAL_CAPTURE_HANDOFF.md).
Its `local_server_proxy` source/`mimoto` actor is separate from browser HAR and the
hosted live bridge. An exclusive run lease, backend-only HMAC correlation and a
strict name/path projection precede persistence; reports retain explicit deployment
limits. Do not read older prototype-only statements as the current implementation.
