# External wallet interoperability, walt.id 1.2.0
Run on Docker Desktop with Linux containers, Compose 2.24.4+ (override/reset tags) and Node 22. Ports 7004–7006 and 18081/18090 must be free or owned by these profiles. The launcher downloads only the official deployment tree from the pinned upstream revision and verifies its HEAD. It publishes three API ports on host loopback; Postgres is not published. The two Inji URLs remain unchanged inside the wallet via a fixed-port TCP relay. Never use these upstream development configurations for real credentials.

From the repository root, after installing dependencies:

```sh
deploy/waltid/run.sh up
MOBILE_COMPOSE_PROJECT=playground-external-certify MOBILE_RUNTIME_DIR="${TMPDIR:-/tmp}/playground-external-certify" bash scripts/demo-inji-local.sh
node deploy/waltid/probe.mjs /tmp/external-wallet-check.json
deploy/waltid/run.sh down
```

The Inji command must print LOCAL INJI DEMO PASS. The runner generates a new synthetic account, wallet, holder key, offers and requests each time. It prints only fixed checkpoint labels and statuses, and exits nonzero if a journey stops. An HTTP 200 from the wallet is insufficient: the issuing control checks storage, and the presentation control polls the independent verifier. Leave signature checks enabled. The SD-JWT type comes from live metadata, not a sample hostname in a Swagger example.

| Cell | Two fresh executions, 1 November |
|---|---|
| walt.id issuer → walt.id wallet | SD-JWT stored |
| walt.id wallet → walt.id verifier | SUCCESSFUL with presented credential |
| Inji Certify → walt.id wallet | Offer created; wallet receive returned HTTP 500 |
| walt.id wallet → Inji Verify | Verify created the request; wallet present returned HTTP 500; no Verify verdict |

[First run](../../submission/evidence/2026-11-01-waltid/first.json) · [repeat](../../submission/evidence/2026-11-01-waltid/repeat.json) · [Inji positive control](../../submission/evidence/2026-11-01-waltid/inji-control.json).
These observations establish two integration boundaries for this configuration, not two confirmed upstream defects. For follow-up, compare offer discovery versus issuer metadata resolution, and signed request retrieval versus presentation creation, one hop at a time.

Optional paired example check: append `--example-control` after the output filename. It requests the credential type from the verifier's published Swagger example, then compares it with the run using the issuer's actual metadata. Keep both observations; a failed session for a nonmatching type is the correct verifier behavior.
