# Person 2 — acceptance record to fill after local integration

Status: **managed acceptance pending / not tested here**, not a result or a new shared schema. Preparation can be completed independently; managed capture acceptance requires the settled owner contracts. Use one fresh playground-managed run and the pinned, persistent synthetic test wallet. The historical hosted success does not satisfy this checklist. Main now records a direct local JSON-LD positive case in `submission/evidence/2026-10-26-local-web-jsonld/`; it explicitly has no BFF run ID and does not fill the managed-run rows below.

## Before starting

- [ ] Person 4 provides a runnable joined stack, public/container endpoint sheet, JSON-LD catalog/configuration/type, registered client/redirect, trust/key services and component versions/digests. Record unknown versions as `unreported`.
- [ ] Person 1 provides working server-hop proxy routing, actor/rule IDs, same-run correlation and passing leakage tests. Distinguish browser → Mimoto from Mimoto → Certify/Verify; mark any missing hop `not_observed`.
- [ ] Integrator approves local URL/TLS policy, the matching local issuer/Verify protocol adapter and recorded deployment provenance. No guard bypass or shared-schema invention.
- [ ] Provisioned synthetic wallet unlocks with its external owner-only passcode file. No passcode, login state, credentials or raw HAR enters this checklist or artifacts.

## Execution and evidence record

| Checkpoint | Actual result to fill | Required evidence |
| --- | --- | --- |
| Fresh managed run | `not_tested`; run ID: — | BFF-assigned UUID, configuration, timestamps, profile and deployment/version metadata |
| Synthetic login and wallet unlock | `not_tested` | Browser stage result, without account/session information |
| JSON-LD issuance | `not_tested` | Same-run exchange IDs and actor/rule labels; distinguish which hops were observed |
| Persistent wallet storage | `not_tested` | Explicit operator confirmation plus card present after refresh; issuance HTTP success alone is insufficient |
| Correlated presentation | `not_tested` | Same-run presentation exchange IDs and backend correlation result; do not record raw request URI or state |
| Independent Verify result | `not_tested` | Normalized verifier outcome and result exchange ID; transport 2xx is not a verifier verdict |
| Persistence screenshot | `not_tested`; path: — | Reviewed crop showing the stored synthetic card after refresh, with account/claim values excluded |
| Repeatable managed browser command | Pending managed capture integration; the existing direct harness is `pnpm demo:web-jsonld`, or `pnpm check:web-jsonld` then `pnpm check:web-presentation` | Exact command/environment variable **names**, pinned versions and reviewed artifact allowlist for Person 4; distinguish direct harness results from a BFF-managed run |
| Replay of acceptance command | `not_tested` | Fresh run ID and result; no reuse of earlier presentation traffic |

Keep public run/exchange IDs only. Do not include query strings, request bodies, headers, tokens, cookies, passcodes, private keys or raw network recordings. Save reviewed evidence only under the Person 2 evidence directory. Stop and record the failed checkpoint instead of filling later rows as passed.

## Separate SD-JWT Web attempt

- [ ] Record the pinned wallet and protocol versions, credential/profile and the exact attempted checkpoint.
- [ ] Separate a playground selector/backend policy restriction from an observed wallet capability restriction. The JSON-LD-only assisted backend cannot establish that the wallet itself lacks SD-JWT support.
- [ ] Record `passed`, the exact observed unsupported point, or `blocked/not_tested`; never promote a Reference Wallet, fixture or stand-in result to Inji Web acceptance.

## Final review

- [ ] All checkpoint evidence belongs to the same fresh run, with issuance preceding storage confirmation and presentation.
- [ ] Inspector, archive, comparison and reports preserve provenance and withheld-name semantics.
- [ ] Run privacy audit, relevant tests/typechecks/build and the real acceptance command; record actual counts, skips, limits and reviewed artifact paths.
- [ ] Give Person 4 the proven command and environment/artifact rules for CI. Integrator reviews provenance/version metadata and determines team acceptance.
