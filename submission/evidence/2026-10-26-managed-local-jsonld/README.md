# Playground-managed local JSON-LD acceptance — 26 October 2026

**Observed pass:** run `f5f56b45-3160-49b3-96ff-e1238c412fb1`, completed
2026-10-26 10:37 IST (05:07 UTC). Implementation/source:
`f959edc145b82da04695353a51e9c3cf4e32a9b0`; the source tree was clean when the
managed command collected its provenance. This is a real fresh BFF/PostgreSQL run,
not a synthesized record for the earlier direct browser harness.

Official local Certify **0.14.0** → official Inji Web **0.17.0** / Mimoto **0.22.0**
→ official local Verify **0.18.2**. The expected configured image digests were checked
against the running containers; [provenance](provenance.json) includes image IDs.
The original services are unpatched. The synthetic authorization fixture and
explicit issuer-DID relationship adapter remain part of this deployment.

## Same-run evidence

| Checkpoint | Result | Saved evidence |
|---|---|---|
| Certify token hop | HTTP 200, `mimoto → certify`, `certify-token` | `2bcc7e2a-5a7f-4a5c-9bfc-22aca5d06037` |
| JSON-LD credential hop | HTTP 200, `mimoto → certify`, `certify-credential` | `f8955c1a-ef25-46a0-8f09-8553e5a5cd99` |
| Exact card after reload | Passed; linked storage confirmation follows issuance | [browser checks](browser-checks.json), `STORE` summary |
| Same-wallet exact-card presentation | Passed; original signed request passed by value | [browser checks](browser-checks.json) |
| Verify submission hop | HTTP 200, `mimoto → verify`, `verify-submit`; backend state-tag match | `7c40f6a3-7a7e-43b7-806c-67d7bfeec00e` |
| Independent Verify result | `valid`; credential proof and holder proof both true | `PRESENT_RESULT` and its separate `playground → inji_verify` exchange in the [run report](run-report.json) |

The independent result is fetched by the local BFF verifier adapter, not inferred
from Mimoto's HTTP status. Browser helper checks keep wallet/card identifiers in
private runtime memory/files and export only equality/reload booleans. No raw VC,
VP, state, headers, authentication token, signed-request query or real HAR is in
this bundle.

## Captured and unobserved boundaries

[Coverage](coverage.json) separates `serverHops` from browser `coverage`.
The managed command attaches the server forwarder, not the browser bridge:

- Certify token and credential server hops: observed, with saved exchange IDs.
- Mimoto → Verify direct post: observed and matched with the BFF run's state tag.
- Mimoto → Verify request fetch: **not_observed**, because the signed request is
  passed by value. The BFF's own request fetch is a separate driver exchange.
- Browser → Mimoto: not attached in this recording; separate browser coverage
  remains missing. Server capture never substitutes for that browser observation.
- Storage: established by the separate exact-card reload check and confirmation,
  not by issuance transport alone.
- IAR's initial VP ceremony, DID/context fetches, native wallet traffic, internal
  wallet encryption and revocation/status-list checks: not established here.

The API's generic evidence tier remains `unverified`. The report's
`deploymentEvidence` explicitly identifies this local synthetic profile and its
observed hops; no conformance badge or automatic team acceptance is added.
Hosted A1 and hybrid Android A2 remain separate records with their own versions.

## Reproduce

Follow the [capture handoff](../../../docs/PERSON1_LOCAL_CAPTURE_HANDOFF.md).
With the pinned local profile and persistent synthetic wallet already provisioned:

```bash
pnpm capture:local:prepare
# Terminal A:
pnpm capture:local
# Terminal B:
pnpm capture:local:attach
pnpm check:web-managed
```

Use the handoff's explicit local UI flag if operating through the playground UI.
Private runtime settings are generated outside Git; do not share their contents.

## Validation and practical limits

[Validation](validation.json): 423 ordinary automated tests passed (four opt-in DB
checks skipped there), the separate 16-test PostgreSQL boundary suite passed with
no skips, 17 app browser/keyboard/axe/zoom checks passed, and typecheck/build/secret
audit passed. The PostgreSQL suite includes actual raw exchange-row reads and
HTTP/API/report/socket payload inspection with full-VC, token, state and header
canaries. Counts overlap across suites; do not sum them as unique tests.

Earlier development attempts included a presentation HTTP 400, an issuance HTTP
500 and a download-window failure followed by an expired-lease rejection. They
were not counted as passes. Service diagnostics also showed public-context/DNS
failures, but the exact cause of every failed attempt was not isolated. The direct
positive control and fresh managed run subsequently passed. The dependency on
public JSON-LD contexts and the missing external `KERNEL` HSM health alias remain
reliability/deployment limits. The captured passing run does not prove offline
operation, stock DID interoperability, production eSignet/IAR authorization,
independent-machine setup, mobile acceptance or SD-JWT Web support.

No new screenshots are included: this bundle proves capture/correlation with safe
metadata; the earlier [direct local wallet bundle](../2026-10-26-local-web-jsonld/README.md)
has the separately reviewed synthetic UI screenshots.
