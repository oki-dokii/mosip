# Person 1 → Person 2 / integrator: canonical local capture

26 October 2026. This handoff implements the pending server-hop and subject-name
contracts. Existing hosted browser bridge behavior remains separate.

**Implemented and tested:** `f959edc145b82da04695353a51e9c3cf4e32a9b0`. Fresh managed run `f5f56b45-3160-49b3-96ff-e1238c412fb1` passed from a clean source tree; [sanitized exchange IDs, coverage, provenance and validation](../submission/evidence/2026-10-26-managed-local-jsonld/README.md).

## What is ready

The local forwarder now records the actual Mimoto → Certify token/credential and
Mimoto → Verify direct-post hops into one active playground run. Capture completes
before the protocol response is delivered to Mimoto. Request and response bytes,
including signatures, are unchanged for the pinned Certify 0.14 JSON-LD profile.
This instrumentation extends the canonical bridge; it does not add `/tap/` URLs or
change issuer identifiers, redirect URIs, signed request/VP values or TLS verification.
The existing declared authorization/metadata/DID adapters are still adapters.

The token hop runs through the existing synthetic IAR fixture on Mimoto’s behalf;
`via: local_issuer_bridge` identifies the forwarding boundary. Token-fixture grant
translation is separate from byte-preserving credential/VP forwarding.

The BFF local profile has its own pinned Verify 0.18.2 Presentation Exchange adapter.
The hosted DCQL adapter remains separate. Plain HTTP is allowed only for the exact
local origins/paths in this profile. Returned `https://local.test` request references
are validated and fetched through the corresponding fixed host-loopback Verify path;
there is no arbitrary URL resolver, insecure TLS flag or global HTTP exception.

## Run it

Prerequisites: locked dependencies, Docker Desktop, Playwright Chromium, the core
PostgreSQL database/migrations, and the persistent synthetic local wallet. The
existing `pnpm demo:docker` prepares the core database; `pnpm demo:web-jsonld`
provisions/tests the direct local wallet. Do not delete those volumes or change
Certify back to the alpha SD-JWT profile during a managed JSON-LD run.

For a first setup:

```bash
pnpm stage:web-jsonld
pnpm check:web-local
pnpm capture:local:prepare
```

Terminal A, keep running:

```bash
pnpm capture:local
```

Terminal B:

```bash
pnpm capture:local:attach
pnpm check:web-managed
```

For the playground UI, use a separate terminal with its explicit local action policy:

```bash
VITE_ASSISTED_LOCAL_PROFILE=jsonld-0.14 PLAYGROUND_BFF_URL=http://127.0.0.1:4500 pnpm --filter @playground/web dev
```

Only the exact `127.0.0.1:18093` wallet routes are permitted by that local build;
the default hosted UI still rejects plain HTTP actions. Transient action URLs may
contain the signed request by value because that is the pinned wallet's interface.
They remain in BFF/browser memory and are intentionally absent from run records,
reports, socket payloads and this handoff. Do not capture query URLs in screenshots.

The managed command creates a fresh run, issues through the real Web wallet,
checks the exact newly issued card after reload, sends its storage confirmation,
uses that run's signed presentation request, selects the same card/wallet and waits
for the BFF's independent Verify result. It fails if required server hops are absent.
It exports only sanitized report/coverage JSON under the owner-only runtime's
`managed-evidence/` directory. Review those files before committing them. It does
not export browser action URLs, wallet IDs, credential IDs, auth state or HAR.

On repeat setups with capture already enabled, start Terminal A before staging or
using the bridge: unavailable capture persistence intentionally fails closed.
Settings are loaded at bridge startup; rerun `capture:local:attach` after changes.
`LOCAL_CAPTURE_BFF_PORT` changes the default 4500 when preparing settings;
`LOCAL_ASSISTED_BFF_URL` selects that same loopback origin for the managed test.
`MIMOTO_RUNTIME_DIR`, `MOBILE_RUNTIME_DIR`, `DATABASE_URL` and `WEB_ORIGIN` are optional
configuration names. Never paste their secret file contents into a handoff.

## Listener and route configuration

| Surface | Address | Boundary |
|---|---|---|
| Local capture BFF | host `127.0.0.1:4500` | Dedicated local profile; existing 4000 demo is untouched |
| Certify canonical bridge | Mimoto namespace `127.0.0.1:18090` | Fixed upstream `mobile-certify:8090` |
| Verify HTTP bridge | Mimoto namespace `127.0.0.1:18081` | Fixed upstream `verify-service:8080` |
| Verify canonical TLS bridge | private container-network `https://local.test:443` | No host 443 publication; generated certificate trusted only by service JVM copies |
| Bridge → capture BFF control channel | `host.docker.internal:4500` | Docker Desktop reaches the host loopback BFF; generated transport token, no correlation key |

Host-published ports are loopback-bound. The TLS/DID listener is reachable inside
the isolated local Docker networks because Verify/Mimoto resolve the same canonical
DID there. This is a local synthetic deployment, not a public multi-user proxy.

| Actor from → to | Rule ID | Step key | Actual route |
|---|---|---|---|
| `mimoto → certify` | `certify-token` | `ISSUE_TOKEN` | `POST /v1/certify/oauth/token` |
| `mimoto → certify` | `certify-credential` | `ISSUE_CREDENTIAL` | `POST /v1/certify/issuance/credential` |
| `mimoto → verify` | `verify-request-fetch` | `PRESENT_REQUEST` | `GET /v1/verify/vp-request/{id}` if actually fetched |
| `mimoto → verify` | `verify-submit` | `PRESENT_SUBMIT` | `POST /v1/verify/vp-submission/direct-post` |
| `playground → inji_verify` | driver exchange, not a browser rule | `PRESENT_REQUEST` / `PRESENT_RESULT` | Request creation/fetch and independent result poll |
| `browser → mimoto` | existing `mimoto-wallet-*` rules | corresponding step | Existing browser bridge only; never inferred from server capture |

`request.source` is `local_server_proxy`; `request.capture.provenance` is
`canonical_local_forwarder`. The URL uses the existing sanitized rule template,
not a raw dynamic path. HTTP 2xx is transport evidence only.

## Correlation and persistence contract

1. Starting a live `jsonld-0.14` assisted run claims the exclusive local capture
   lease before any wallet traffic. A second concurrent local run is rejected.
2. The forwarder snapshots `{runId, leaseId, expiresAt}` before forwarding each
   matching request. Cancellation, completion and expiration invalidate the lease;
   an old response cannot be attributed to a later run. These lease values do not
   appear in persisted exchange payloads.
3. In memory, the forwarder reduces raw JSON to the narrow validated `publicView`.
   Headers, tokens, cookies, proof bytes and credential values are never uploaded.
   Only the direct-post state scalar crosses the authenticated private control
   channel in memory; the BFF immediately replaces it with its run-keyed HMAC tag.
4. The BFF compares that tag with the one derived from its own signed request.
   The random process master key and derived run key remain in BFF memory. No key
   is exported. Standalone HAR HMAC tags are not reused.
5. The BFF assigns the run's existing step ID and atomic exchange sequence, then
   persists before emitting the normal metadata-only `exchange:recorded` event.
   The assisted driver's repository subscription sees the saved exchange.
6. `STORE` requires a separate confirmation linked to the issuance exchange ID.
   The managed browser command sends it only after exact-card reload succeeds.
   Capture alone never proves storage. `PRESENT_RESULT` requires an independent
   Verify response, including issuer and holder proof checks for a local valid pass.

Private control endpoints use the generated `x-capture-bridge-token` header:
`GET /api/v1/capture/local/session` and
`POST /api/v1/capture/local/observations`. They accept no raw HAR, headers, tokens or
VCs. Projection keys/values are allowlisted again in the BFF; malformed input has
codes-only errors, 32 KiB body limits and a 120 POST/minute peer limit. Control
settings/token live in owner-only runtime files, not this repository or images.

## Inspector contract: JSON-LD names and paths

The frozen `Exchange` shape is unchanged. The following is additive inside
`exchange.response.publicView.items[]` (and request public views when applicable):

```json
{
  "kind": "verifiable_credential",
  "summary": {
    "types": ["VerifiableCredential", "FarmerCredential"],
    "proofTypes": ["Ed25519Signature2020"],
    "subject": {
      "names": ["farmerID", "fullName", "id"],
      "paths": ["$.credentialSubject.farmerID", "$.credentialSubject.fullName", "$.credentialSubject.id"],
      "withheldNames": 0,
      "truncatedItems": 0
    }
  }
}
```

- **Never decode credentials in the inspector.** Render the supplied names/paths
  as text. No claim values, subject identifiers, salts or proof bytes are present.
- Exact case-sensitive vocabulary: `id`, `type`, `given_name`, `family_name`, `name`,
  `birthdate`, `age_over_18`, `email`, `address`, `nationality`, `fullName`, `farmerID`,
  `streetAddress`, `addressLocality`, `postalCode`, `addressCountry`.
- Unknown/unicode/lookalike names are omitted and counted in `withheldNames`.
  Their descendants are not traversed. Do not invent a label from an unknown name.
- Arrays use `[*]` paths; at most 8 elements, 32 keys per object, 32 output paths,
  depth 4 and a 128-node traversal budget. Omitted/depth/budget work increments
  `truncatedItems`. Counts describe inspected/truncated work, not a complete schema.
- Missing `subject` means no available projection; empty lists do not prove that
  the underlying credential had no claims. Repeated array paths/names are deduped.
- View authenticity remains `not_verified`. Projection is not signature validation;
  the verifier verdict is a separate exchange. Top-level counters may also include
  other projected objects in the same body.

## Coverage, provenance and review

`GET /api/v1/runs/{id}/capture/coverage` preserves `coverage` for browser capture and
adds `serverHops` with `observed` / `not_observed` and saved exchange IDs. This local
managed command does not attach browser capture: browser→Mimoto stays missing in
that view. Mimoto request fetch stays `not_observed` when the JWT is passed by value.
DID resolution, external context loads, initial IAR ceremony, native traffic and
wallet encryption internals are not captured. Do not turn those into observed hops.

Local runs record Certify 0.14.0, Web 0.17.0 and Verify 0.18.2 configured labels;
Mimoto 0.22.0 and actual image digests belong in the evidence provenance manifest.
`local-jsonld-pex-0.18.2` is a distinct protocol profile. Reports add
`deploymentEvidence` with explicit synthetic-auth/DID/context boundaries; the generic
`unverified` tier is intentionally not promoted by this work or by HTTP success.
Team acceptance remains separate.

Hosted A1 and Android A2 retain their own deployment/version boundaries. The
historical hosted A1 export incorrectly recorded `reference-wallet/0.1.0`. Its
immutable original is preserved; `archivedA1.ts` already corrects the API wallet
version to `unreported`. Do not replace it with the local Web 0.17 version. The
Android About-screen version is not an independently attested installed binary.

## Verification commands

```bash
pnpm --filter @playground/bff exec vitest run src/capture/local-server.test.ts src/capture/local-integration.test.ts src/drivers/localWebVerifier.test.ts
# Set CAPTURE_POSTGRES_TEST_URL privately to the local migrated test database:
pnpm --filter @playground/bff exec vitest run src/capture/local-integration.test.ts src/capture/har.test.ts
pnpm typecheck
pnpm test
pnpm build
pnpm audit:secrets
```

The PostgreSQL suite exercises raw rows, HTTP API/report reads and emitted socket
payloads with planted full-VC, token, state, auth and private-field canaries. The
ordinary suite skips DB cases unless the private test URL is set. The forwarding
integration also asserts byte-identical request/response delivery. Real-wallet
positive evidence and remaining unobserved hops are linked in the dated evidence
bundle; intermittent public-context/network failures are not silently counted as passes.
