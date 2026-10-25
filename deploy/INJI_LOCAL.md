# Local official Inji control

The local control runs **official Inji Certify → a non-Inji reference holder → official Inji Verify** with a synthetic SD-JWT. Both Inji services and their databases run on this machine. Issuer and verifier bind to loopback; the control makes no Collab call and opens no public tunnel. A successful run prints `LOCAL INJI DEMO PASS` and a sanitized verdict with Verify transaction/request IDs.

This is a service interoperability control, **not an all-Inji wallet run**. The separate [managed Inji Web record](../submission/evidence/person2-managed-a1-2026-10-25/README.md) and [actual Android wallet result](../submission/evidence/person3-a2-mobile-2026-10-23/README.md) provide real-wallet evidence in their recorded hosted/hybrid environments. Mimoto and Inji Web are not in this local control.

## Run

Install Node.js 20+, pnpm 11.25.0, Docker Engine/Compose and OpenSSL. Docker needs enough memory for two Java/DB services. First setup needs network access to pull pinned images and download the tagged public Certify configuration/schema; the protocol run uses loopback endpoints.

```sh
pnpm install --frozen-lockfile
pnpm demo:inji
```

`demo:inji` starts the isolated Verify database and service, starts the existing official Certify instance in loopback-only mode, waits for both, then runs `scripts/local-inji-smoke.mjs`. It leaves the containers running so the result can be repeated:

```sh
node scripts/local-inji-smoke.mjs
```

Acceptance requires a pre-authorized offer and token, credential returned by Certify, independent verification of the issuer signature and holder binding, a fresh signed Verify request, direct-post of a holder-bound presentation, and Verify's `allChecksSuccessful: true` with credential and holder proof checks true. The CLI prints only the sanitized result; it never writes the credential, VP or holder key. The official services can store raw synthetic material in their dedicated Docker databases, and Certify keys remain in the owner-only runtime. No raw material is committed or sent to the playground database. Identity claims are synthetic.

After the services are running, `pnpm probe:inji` creates separate fresh Verify requests for a valid control and six isolated negatives: wrong nonce, wrong audience, exact VP replay into a fresh challenge, broken issuer signature, wrong state and a descriptor path pointing beyond the VP array. It prints only match flags, transaction/request IDs, HTTP statuses and verifier verdicts. The probe intentionally exits nonzero if Verify accepts a negative case. On the pinned local 0.18.2 profile, the three holder-binding/replay cases and wrong descriptor path returned `allChecksSuccessful: true`; the broken issuer signature returned false and wrong state received HTTP 404. See the [seven-case sanitized matrix](../submission/evidence/2026-10-25-local-inji-extended-matrix.json) and [G-06/G-07](../docs/GAPS.md). This is a versioned local observation, not a statement about Collab or newer Verify releases.

Stop **only these dedicated services**, preserving their test databases and generated keys:

```sh
pnpm mobile:inji stop
docker compose -p mosip-local-inji -f deploy/docker-compose.verify-local.yml down
```

Do not add `-v` unless you intend to delete the synthetic Verify database. The phone launcher and local control reuse the dedicated Certify project `mosip-mobile-a2`; do not run them simultaneously. The local demo uses no phone and does not change the recorded A2 evidence.

## Pinned components and protocol

| Component | Pin | Local endpoint |
| --- | --- | --- |
| Inji Certify with plugins | `injistack/inji-certify-with-plugins:1.0.0-alpha.1@sha256:1579b2449f1a7213fe25de1f6a1509b5636f1fedf0d7f5c4cfd07b9f0fc5b346`; source/config commit `8fdf71656979a72fa8263766d4dec3cc25127b76` | `http://127.0.0.1:18090/v1/certify` |
| Inji Verify service | `injistack/inji-verify-service:0.18.2@sha256:2ed468e7e1f1ce317a41476dd131f4ce8f081b0f055a080c95e99a92cc192bdd` | `http://127.0.0.1:18081/v1/verify` |
| Verify PostgreSQL | `postgres:13@sha256:4689940c683801b4ab839ab3b0a0a3555a5fe425371422310944e89eca7d8068` | Compose network only |
| Certify PostgreSQL | `postgres:16-alpine` in the dedicated mobile Compose project; tag not digest-attested | Compose network only |

Certify issues `dc+sd-jwt` through its pre-authorized grant. Verify 0.18.2 creates a Presentation Exchange request with `vc+sd-jwt`, then accepts the presented token at `/vp-submission/direct-post`. The control records both format labels because these component generations use different names; the observed Verify result decides this particular combination. The reference holder signs the OpenID4VCI proof and SD-JWT key-binding JWT with a fresh Ed25519 key. Certify signs with RS256 and an X.509 certificate header. The smoke checks the issuer JWT with that certificate before submission.

The official v0.18.2 [sample Compose seed](https://github.com/inji/inji-verify/blob/v0.18.2/docker-compose/db-init/init.sql) omits `response_code`, `response_code_expiry_at` and `response_code_used` from `vp_submission`, although the same release's [tagged DDL](https://github.com/inji/inji-verify/blob/v0.18.2/db_scripts/inji_verify/ddl/verify-vp_submission.sql) and service require them. Our isolated [init SQL](verify-db-init.sql) includes those columns. The first local direct-post returned HTTP 500; adding the tagged columns let the same flow reach `valid`. This is a reproducible deployment-packaging observation, not yet an upstream issue or a claim about other Verify deployments.

## Boundaries

- The verifier's DID uses a loopback identifier; this control does not prove external DID resolution or request-signature trust by a real wallet.
- The reference holder, rather than Inji Web/mobile, creates the presentation. The accepted result proves this official Certify/Verify combination with that holder and format profile.
- Certificate-chain/root trust, revocation and native selective-disclosure policy are outside this control.
- The negative probe uses `skipStatusChecks: true` when fetching each result, just like the positive control; status/revocation behavior is not under test. Its VP requests set `responseCodeValidationRequired: false` to match the working local profile.
- Generated Certify keys and DB credentials remain in the owner-only OS temp runtime (`mosip-mobile-inji`) or Docker volumes. The CLI does not export them.
- The [mobile route](MOBILE_INJI.md) remains separate. It uses a temporary HTTPS tunnel and public Collab Verify because a phone cannot reach Mac loopback addresses.

Official upstream references: [Certify pinned source/config](https://github.com/inji/inji-certify/tree/8fdf71656979a72fa8263766d4dec3cc25127b76/docker-compose/docker-compose-injistack) and [Verify v0.18.2 Compose](https://github.com/inji/inji-verify/tree/v0.18.2/docker-compose).
