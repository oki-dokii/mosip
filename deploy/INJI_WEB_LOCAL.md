# Local Inji Web wallet shell

This opt-in profile runs **official Inji Web 0.17.0 + official Mimoto 0.22.0**, an isolated PostgreSQL database, and a small synthetic OAuth2 identity provider. It is a repeatable local test of Web login, Mimoto wallet creation and fresh-session unlock. It does **not** yet connect an issuer catalog or complete local credential issuance and presentation. The existing [local Certify → reference holder → Verify control](INJI_LOCAL.md) remains separate.

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

## Evidence boundary and next step

- `docker compose --wait` checks Mimoto's `/issuers` metadata API. Its aggregate actuator health still reports `HSMHealth: DOWN` because this isolated profile has no separate MOSIP `KERNEL` key alias. This warning is **not** hidden. The tested wallet-create and unlock APIs returned HTTP 200 in spite of that aggregate status; cryptographic operations needed for credential flows remain unproven.
- The first synthetic login reached Web's passcode setup; wallet creation returned HTTP 200; a new browser session showed the existing-passcode page and unlocked the same wallet with HTTP 200. The empty issuer catalog is deliberate and visible in the screenshot.
- To claim an all-local Inji chain, next configure a synthetic JSON-LD issuer in Mimoto, connect it to local Certify, add the verifier trust entry and needed DataShare services, then run issuance, storage, consent, presentation and a correlated Verify result. A running Web page or stored empty wallet alone does not meet that claim.
- The hosted managed [A1 evidence](../submission/evidence/person2-managed-a1-2026-10-25/README.md) is an independent real-wallet JSON-LD result. It does not upgrade this local profile to an issuance/presentation pass.

On the development Mac, after this profile and the existing official Certify/Verify control were running together, the four new containers used about 550 MiB resident memory and the disk had about 6.9 GiB available. This is a local observation, not an independent-machine installation check.
