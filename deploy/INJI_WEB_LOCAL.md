# Local Inji Web wallet profiles

The connected JSON-LD profile runs **official Certify 0.14.0 → official Inji Web 0.17.0 / Mimoto 0.22.0 → official Verify 0.18.2** on this computer. A same-wallet run on 26 October 2026 (IST) issued a synthetic Farmer credential, confirmed that exact card after reload, presented it with consent, and received `allChecksSuccessful: true` with both credential and holder proof checks true. See the [sanitized evidence and boundaries](../submission/evidence/2026-10-26-local-web-jsonld/README.md).

This is an integration fixture with synthetic authorization and a local DID adapter. It does not exercise a real eSignet login or the complete IAR authorization ceremony. The original login-only shell and [SD-JWT reference-holder control](INJI_LOCAL.md) remain available separately.

## Connected JSON-LD demo

Requirements: Node.js 20+, pnpm, Docker Engine/Compose, OpenSSL, a JDK providing `keytool`, and the Playwright Chromium browser. Initial setup needs network access to download pinned images, public configuration and JSON-LD contexts.

```sh
pnpm install --frozen-lockfile
pnpm --filter @playground/web exec playwright install chromium
pnpm demo:web-jsonld
```

The command exits nonzero on a failed checkpoint and prints `LOCAL INJI WEB JSON-LD DEMO PASS` only after Verify returns Valid for the exact newly issued credential in the same persistent wallet. It:

1. Restores the default alpha Certify / Verify SD-JWT reference-holder control and checks it.
2. Seeds the synthetic JSON-LD configuration and checks alpha JSON-LD issuance independently.
3. Switches the dedicated issuer to official Certify 0.14.0 with its bundled CSV data provider.
4. Prepares a seven-day `local.test` TLS certificate and isolated copies of the JVM trust store, then starts the connected wallet and Verify profiles.
5. Creates or unlocks the synthetic wallet, checks a second browser session, issues a credential, and confirms its ID is present after reload.
6. Creates a signed Verify request, drives Web trust/consent, selects that exact credential, submits through Mimoto, and checks Verify's final result.

For individual checks after staging:

```sh
pnpm stage:web-jsonld
pnpm check:web-local
pnpm check:web-jsonld
pnpm check:web-presentation
```

`check:web-jsonld` writes only the issued credential ID and wallet ID to an owner-only temporary correlation record. `check:web-presentation` requires that record and selects its credential explicitly. Public output contains boolean correlation flags and route templates, not either ID. Sanitized result JSON and synthetic UI screenshots are written under the OS temporary `mosip-web-local` directory; passcodes, cookies, tokens, keys, signed requests and VCs are excluded from these artifacts.

```mermaid
sequenceDiagram
  participant Web as Official Inji Web
  participant Mimoto as Official Mimoto
  participant Fixture as Synthetic authorization fixture
  participant Certify as Official Certify 0.14
  participant Verify as Official Verify 0.18.2
  participant Runner as Browser test runner
  Web->>Fixture: Fixed synthetic identity and PKCE authorization
  Fixture->>Certify: Seed isolated synthetic IAR session; exchange code
  Certify-->>Mimoto: Genuine signed token and nonce
  Mimoto->>Certify: Original Ed25519 holder proof
  Certify-->>Mimoto: Genuine signed JSON-LD credential
  Mimoto-->>Web: Stored card; exact ID survives reload
  Runner->>Verify: Create presentation request
  Verify-->>Runner: Original signed presentation request
  Runner->>Web: Launch with the signed request
  Web->>Mimoto: User consent for the same card
  Mimoto->>Verify: Signed VP through local HTTPS direct-post
  Runner->>Verify: Independent result poll
  Verify-->>Runner: Valid, both proofs true
```

### Profile decisions and evidence limits

| Boundary | Implementation and limit |
| --- | --- |
| Official images | Image digests are pinned in the Compose files. Product binaries are unchanged. The bridge is our own test component. |
| Certify version | JSON-LD uses 0.14.0 because it accepts Mimoto 0.22's `Ed25519` JWT proof algorithm. The default SD-JWT profile retains 1.0.0-alpha.1; that release rejected the same algorithm in our local test. |
| Authorization | The bridge creates a short-lived synthetic IAR database session and validates one-use code + PKCE. Official Certify signs the access token. This bypasses IAR's initial VP authorization and does not prove production authorization. |
| Subject binding | The issuer template normalizes base64url padding and uses the wallet's `#0` public key URI. The signed credential retains the wallet proof's key; the bridge logs only a boolean key comparison. |
| DID resolution | `local.test` resolves inside Docker to an HTTPS bridge. It serves the actual issuer/verifier public keys. For Certify's document, it corrects `assertionMethod` to reference the existing Ed25519 verification method; this is an explicit metadata adapter. |
| Local TLS | A short-lived certificate is trusted by these Mimoto/Verify JVM copies only. Host DNS and system trust are unchanged. Port 443 is internal to Docker; browser-facing ports bind host loopback. |
| Presentation | The original signed Verify request is passed by value with `client_id`. The pinned wallet requires this launch envelope and a PE `filter.pattern`. The signed request, nonce, state, credential and VP are not rewritten. |
| Runtime switching | The connected profile reuses the dedicated synthetic Certify database/runtime. It temporarily disables the alpha SD-JWT configuration and adapts its display metadata for 0.14. The SD-JWT launcher restores its own configuration on the next run. Do not run the two issuer profiles concurrently. |
| Capture and playground | This browser check exercises the actual wallet and verifier directly. It does not create a BFF run or upgrade the managed capture evidence tier. Hosted A1 remains separate. |
| Offline operation | Product services are local. Initial downloads and public JSON-LD context resolution still use the network. A clean-machine or offline rehearsal has not been established by this run. |

The connected overlay files are [wallet/DID networking](docker-compose.web-jsonld.yml), [Certify release selection](docker-compose.certify-web-jsonld.yml), and [Verify DID/TLS configuration](docker-compose.verify-web-jsonld.yml). The bridge's independently locked `pg` dependency is installed during its container build. Generated credentials, TLS keys, keystores, synthetic identity data and private correlation records remain outside Git.

### Internal fixture endpoints

These are local test interfaces, not production authentication APIs. `authorize` permits only the fixed client, redirect, synthetic scope and S256 PKCE; `token` requires its one-use code, verifier, client and redirect. Errors contain stable codes and never echo request bodies.

| Interface | Purpose |
| --- | --- |
| `GET http://127.0.0.1:18096/.well-known/oauth-authorization-server` | Advertise the fixture's authorization-code endpoints to Mimoto. |
| `GET http://127.0.0.1:18096/authorize` | Validate fixed OAuth parameters, seed the isolated synthetic session and return the browser's original state with a fresh code. |
| `POST http://127.0.0.1:18096/token` | Validate form-encoded PKCE/code binding; exchange with official Certify and return its genuine token and nonce. |
| Mimoto namespace `http://127.0.0.1:18090/…` | Allowlisted Certify metadata/credential proxy; the same port on the host reaches official Certify directly. |
| Docker-only `GET https://local.test/.well-known/did.json` | Issuer public DID document with the declared assertion relationship correction. |
| Docker-only `GET https://local.test/verify/did.json` | Official Verify's public DID document and signing key. |
| Docker-only `GET https://local.test/v1/verify/vp-request/{id}` | Forward the official signed request unchanged. |
| Docker-only `POST https://local.test/v1/verify/vp-submission/direct-post` | Forward the wallet's presentation unchanged to official Verify. |

## Original login-only shell

The shell runs official Inji Web 0.17.0 + Mimoto 0.22.0, an isolated PostgreSQL database and the synthetic identity provider. Its empty issuer catalog is intentional; use the connected command above for issuance and presentation.

## Start and check

Node.js 20+, pnpm, Docker Engine/Compose and OpenSSL are required. First setup pulls pinned official images and downloads tagged upstream public configuration and schema files. The preparation script SHA-256 checks every downloaded file before writing it to an owner-only OS temp directory. It generates a random database password, OAuth client secret, PKCS#12 keystore and wallet passcode there; none are committed.

```sh
pnpm install --frozen-lockfile
pnpm stage:web-local
pnpm check:web-local
```

Open **http://127.0.0.1:18093/** and select **Continue With Google**. In this profile, that label points to the local synthetic IdP at loopback port 18095; no Google or Collab account is used. The first login asks for a new six-digit passcode. `check:web-local` generates and saves its passcode under the owner-only temp runtime, creates or unlocks the synthetic wallet, opens a second independent browser session and confirms the same wallet unlocks again. Its output contains route/status evidence only, never the passcode, cookie, OAuth code or wallet key.

The 25 October [sanitized browser check](../submission/evidence/2026-10-25-local-inji-web-wallet.json) passed. The [synthetic UI screenshot](../submission/evidence/2026-10-25-local-inji-web-home.png) shows the resulting official Web wallet home with an intentionally empty issuer list.

Stop only this profile, preserving its synthetic wallet database and generated keystore:

```sh
docker compose --env-file "${MIMOTO_RUNTIME_DIR:-${TMPDIR:-/tmp}/mosip-web-local}/wallet.env" \
  -p mosip-web-local -f deploy/docker-compose.web-local.yml down
```

Do not add `-v` unless you intend to delete its synthetic wallet database. The runtime and Compose volume must be kept together: deleting the generated keystore while retaining the encrypted database can make the wallet unusable. The stack binds Web, Mimoto and IdP ports to host loopback. The IdP automatically approves a fixed fake account and must never be exposed as a real login service.

## Pinned implementation

| Component | Pin / source | Local role |
| --- | --- | --- |
| Inji Web | `injistack/inji-web:0.17.0@sha256:62ca25a6c2f5c3d61edfed1e43e52885f1bcf1229b3a3ffb89c117245f839719`; [tagged upstream Compose](https://github.com/inji/inji-web/blob/v0.17.0/docker-compose/docker-compose.yml) | Official wallet UI and reverse proxy, `127.0.0.1:18093` |
| Mimoto | `injistack/mimoto:0.22.0@sha256:89fc81eeb8c911c8a9944e4071d8f3e8f287d3de697c4461f2b3a2e8ce29858e`; [tagged source](https://github.com/inji/mimoto/tree/v0.22.0) | Official wallet backend, `127.0.0.1:18099` |
| PostgreSQL | `postgres:13@sha256:4689940c683801b4ab839ab3b0a0a3555a5fe425371422310944e89eca7d8068` | Dedicated Mimoto data and tagged seed schema |
| Synthetic OAuth2 provider | This repo's [small local server](../scripts/local-web-idp.mjs), `node:22-alpine@sha256:fe4f6d74e20370acb04ad889077d14d0f64a9c8ea6a42bc60cddf1e844699914` | Fixed fake identity, `127.0.0.1:18095` |
| CBEFF schema | [Pinned MOSIP config commit](https://github.com/mosip/mosip-config/blob/9f995c06228a1b9b718c00bf54caef5dbd77aacf/mosip-cbeff.xsd) | Served locally because Mimoto loads it at startup |

The preparation script retrieves four configuration/schema files from the [tagged Inji Web source](https://github.com/inji/inji-web/tree/v0.17.0/docker-compose) and the pinned MOSIP schema commit. It verifies exact hashes and stores their working copies outside Git. The local copy rewrites Collab URLs to inert endpoints, sets a loopback Web URL and local synthetic OAuth2 endpoints, and leaves the issuer and verifier catalogs empty. The source's configuration includes sample passwords, so it is never copied into the repository.

## Historical shell evidence boundary

- `docker compose --wait` checks Mimoto's `/issuers` metadata API. Its aggregate actuator health reports `HSMHealth: DOWN` because this isolated profile has no separate MOSIP `KERNEL` key alias. This warning is **not** hidden. Wallet APIs and the connected profile's selected issuance/presentation operations passed despite this aggregate status; this does not establish general HSM readiness.
- The first synthetic login reached Web's passcode setup; wallet creation returned HTTP 200; a new browser session showed the existing-passcode page and unlocked the same wallet with HTTP 200. The empty issuer catalog is deliberate and visible in the screenshot.
- The connected profile above now covers issuance, storage, consent, presentation and a correlated local Verify result with an embedded VC. DataShare is not used by that flow.
- The hosted managed [A1 evidence](../submission/evidence/person2-managed-a1-2026-10-25/README.md) is an independent real-wallet JSON-LD result. It does not upgrade this local profile to an issuance/presentation pass.

On the development Mac, after this profile and the existing official Certify/Verify control were running together, the four new containers used about 550 MiB resident memory and the disk had about 6.9 GiB available. This is a local observation, not an independent-machine installation check.

## Playground-managed local capture

The direct browser command above remains separate. The new
[Person 1 local capture handoff](../docs/PERSON1_LOCAL_CAPTURE_HANDOFF.md) provides
`capture:local:prepare`, `capture:local`, `capture:local:attach` and `check:web-managed`
for a fresh BFF run with captured canonical Mimoto server hops. It uses the same
pinned JSON-LD profile and explicit adapters, saves redacted exchanges, confirms the
exact issued card after reload, and obtains an independent Verify result. Browser
capture remains a separate coverage surface; a by-value request is not a Mimoto
request-URI fetch. This does not change the historical direct or hosted evidence.
