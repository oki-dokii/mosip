# Remaining technical work — 26 October 2026

This is the current engineering backlog after reviewing Person 4's four follow-up
commits. It excludes presentation, video and submission administration. Earlier
person plans contain historical tasks; use this checkpoint to avoid rebuilding
completed features.

## Completed baseline

- Hosted playground-managed A1 JSON-LD evidence exists; final team review is pending.
- The local official Certify 0.14 → Web 0.17 / Mimoto 0.22 → Verify 0.18.2
  JSON-LD journey passed exact-card issuance, reload and same-wallet presentation,
  with credential and holder proof checks true. Synthetic authorization and a DID
  relationship adapter remain explicit boundaries.
- Android A2 has an observed hybrid pass: local Certify → Android → Collab Verify.
- Capture/redaction, reports, standalone mocks, six-case mock Docker demo, ordinary
  CI, mock nightly checks, run comparison/archive views and accessibility tests exist. The latest teammate
  commit adds real Chromium tab zoom at 200%/400% and 320px table contrast checks.
- Person 4's endpoint catalogue and readiness smoke are integrated. The unified
  launcher delegates to the proven projects, avoiding duplicate-port deployments.

## Finish in this order

| Priority | Owner | Remaining work | Done when |
|---|---|---|---|
| 1 | Person 1 + integrator | Connect the local browser harness to an active BFF run; capture local server hops with sanitized actor/step/rule correlation. Keep browser→Mimoto and downstream Certify/Verify exchanges distinct. | A local run has persisted exchange IDs, explicit coverage boundaries and DB/API/socket canary-leak checks. No raw VC, token or state is stored. |
| 2 | Person 2 | Drive the proven local JSON-LD journey through the playground using Person 1's sanitized exchanges. The existing direct browser harness already proves wallet behavior. Review the hosted A1 evidence with the team. | One playground-managed local run links the exact wallet/card, reload confirmation, presentation and independent Verify result. |
| 3 | Person 4 | Add an opt-in hosted CI job for the connected local wallet command and Person 3's settled live matrix. Existing scheduled CI runs mocks only. Preserve expected-fail distinctions. | A fresh runner produces a positive wallet control and sanitized artifacts; unexpected regressions fail, reproduced upstream negatives are separately reported. |
| 4 | Person 4 + another teammate | Rehearse installation on an independent machine. Current evidence includes this Mac and hosted mock CI, not an independent full Inji wallet setup. | A teammate follows the README from a fresh checkout and records platform, versions, command/result and exact blockers. |
| 5 | Person 3 | Refresh the version-pinned local protocol matrix with positive controls; reduce the strongest replay/nonce/audience/descriptor findings and link each to spec expectations. Twenty catalogue entries are not twenty proven live passes. | Each executed case has versions, one changed variable, expected/actual result and dated evidence. Unexecuted cases remain labelled. |
| 6 | Person 3 + phone operator | Attempt Android → fully local Verify. The existing hybrid Android pass remains valid but separate. | A real phone issues, reloads and presents to local Verify, or the exact failed checkpoint is recorded. |
| 7 | Integrator + Person 3 | Reconcile dated aggregate reports and the machine-readable gap register with current A1/local JSON-LD evidence and G-09/G-10. The aggregate generator still emits historical A1-blocked wording. | UI gap entries and regenerated reports agree with dated source evidence, without inventing BFF records for direct harnesses. |

Human UX validation also remains: run the [manual accessibility checklist](../spikes/person2-web/MANUAL_ACCESSIBILITY_CHECKLIST.md) for VoiceOver/NVDA, enlarged-text visual review and physical-device use. Automated checks do not establish those results.

## Valuable extensions after those gates

| Owner | Extension | Boundaries |
|---|---|---|
| Person 1 | Review outbound URL/SSRF controls, deployment authentication, CSP, retention and safe reset/backup. Close concrete gaps with tests. | Loopback synthetic demo readiness does not establish readiness for public multi-user deployment. |
| Person 2 + Person 3 | Pinpoint SD-JWT Web presentation support; same-device/deep-link checks if supported. | JSON-LD success does not imply SD-JWT support. An unsupported upstream feature is a documented limit, not a reason to claim a pass. |
| Person 3 | One protocol-aligned independent external issuer/verifier, then a second-device check. | The walt.id study is research until an executable cross-vendor flow has its own evidence. |
| Person 4 | Pin remaining floating image digests, dependency/transitive-license checks and focused linting. | Do not replace the proven version set merely to match another repository's feature count. |

Full real eSignet/IAR authorization, removal of the DID adapter, offline context
mirroring and resolution of Mimoto's external KERNEL HSM health warning are further
local-stack improvements. The passing flow does not prove these. mDoc, DC API and
iOS are optional exploratory tracks, not prerequisites for the recorded JSON-LD pass.

## Integration verification

Person 4 branch: `person4/packaging-ci`, commits `cd8d185`, `4b23c0b`,
`a357c29`, `ad6a057`. Original author history is preserved by a merge.

Reviewed and corrected: duplicate-port launcher, stale JSON-LD status, inaccurate
container loopback origins, smoke success on unavailable services, synthetic empty
JWKS handling, and response/error output boundaries. The legacy combined Compose
shell is not the supported connected profile. Use:

```bash
pnpm start:local-full
pnpm smoke:local-full
pnpm demo:web-jsonld
pnpm stop:local-full
```

The readiness command does not create a BFF run or re-prove the wallet journey.

Verification during this merge: typecheck and production build passed; 413 ordinary
automated tests passed with three opt-in PostgreSQL tests skipped; all 17 browser
checks passed on isolated ports, including keyboard/axe, native Chromium zoom and
mobile table contrast checks. Browser TypeScript and bounded evidence audits also passed. Local readiness
passed 8/8; secret audit passed; aggregate-report consistency passed (it checks
consistency, not freshness of the historical narrative). The legacy alternative
Compose file parsed successfully but was not started. The unchanged full wallet
chain was already evidenced at `77d7d10`; readiness is not a new full-chain run.
