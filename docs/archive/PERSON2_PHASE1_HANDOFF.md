> Archived helper-preparation record; original scope `spikes/person2-web/`. See [current capture/managed acceptance](../PERSON1_LOCAL_CAPTURE_HANDOFF.md).

# Person 2 Phase 1 — local Web preparation

26 October 2026. **Fixture/helper preparation complete; all-local A1 not tested.** No local deployment, browser wallet or managed run is created by the offline tests. The hosted 25 October A1 record remains independent.

## Files and commands

- `local-profile.json`: confirmed public loopback endpoints and image pins from the existing **separate** local deployment documents. It explicitly leaves JSON-LD credential configuration/type and canonical capture proxy unconfirmed. This is not the missing joined endpoint sheet.
- `mimoto-issuers.template.json`: disabled synthetic catalog entry. Keys follow [official Inji Web's pinned catalog](https://github.com/inji/inji-web/blob/a9f4f829d3070be34ae11649327ea1561e123a2b/docker-compose/config/mimoto-issuers-config.json). No upstream service URLs, client secrets or keys are copied. Public fixture labels are proposed labels, not observed metadata.
- `apps/web/browser/local/profile.ts`: reviewed profile loading, strict literal-loopback origin overrides, owner-only external passcode-file reads. Extra JSON fields are discarded. No passcode generation/reset or browser auth persistence.
- `helpers.ts`: reuse existing official Web selectors for login/unlock; issuer/credential selection; card present before and after refresh. Unlock checks the exact POST `/v1/mimoto/wallets/{id}/unlock` route from [pinned Web API source](https://github.com/inji/inji-web/blob/a9f4f829d3070be34ae11649327ea1561e123a2b/inji-web/src/utils/api.ts). Failures expose stage codes, not URLs, response bodies or authentication values.
- `capture-contract.ts`: selects same-run browser/Mimoto exchange IDs from the published sanitized envelope. It does not evaluate request-URI correlation or establish storage/verdict/server-hop evidence. The backend remains responsible for those checks.
- The opt-in Playwright configuration has no `webServer` or Docker startup, no Collab dependency, and disables screenshots, traces and videos. The default configuration ignores `*.local.pw.ts`; its existing smoke cases remain separate. The fixed local profile network allowlist also blocks hosted login redirects.

From the repository root:

```sh
# Pure profile/catalog/privacy-boundary unit tests, no browser/Docker:
pnpm --filter @playground/web exec vitest run browser/local/profile.test.ts

# Offline browser helper fixtures; the real local-shell case is explicitly skipped:
pnpm --filter @playground/web exec playwright test --config playwright.local.config.ts

# Typecheck the opt-in files as well as normal app code:
pnpm --filter @playground/shared build
pnpm --filter @playground/web exec tsc -p tsconfig.local-browser.json --pretty false
pnpm --filter @playground/web typecheck

# Confirm the existing default smoke list excludes the local cases:
pnpm --filter @playground/web exec playwright test --list
```

The live **shell-only** check is separately opt-in. Person 4 must first start/provision the existing synthetic wallet using their documented commands. Use the passcode file created by their checker; never paste its contents into a command or chat. No new wallet or passcode is created by this helper. Example for the default runtime location:

```sh
PERSON2_LOCAL_LIVE=1 \
PERSON2_SYNTHETIC_PASSCODE_FILE="${MIMOTO_RUNTIME_DIR:-${TMPDIR:-/tmp}/mosip-web-local}/synthetic-wallet-passcode" \
pnpm --filter @playground/web exec playwright test \
  --config playwright.local.config.ts --grep 'opt-in local shell'
```

That test opens two independent browser contexts and closes them without `storageState`, HAR, screenshots or video. It proves only existing-wallet login/unlock when actually run. Do not enable Playwright debug logging, trace collection or credential-bearing report attachments for it. A prepared optional `PERSON2_LOCAL_PROFILE_FILE` may override only explicit literal-loopback origins; the Phase 1 profile cannot declare integration readiness or invent a JSON-LD profile. Custom local DNS names require an owner-approved endpoint/capture contract; do not relax these guards speculatively.

## Person 4 catalog and endpoint handoff

Sources inspected: `deploy/INJI_WEB_LOCAL.md`, `deploy/INJI_LOCAL.md`, both local Compose definitions, `scripts/prepare-inji-web-local.mjs`, `scripts/check-inji-web-local.mjs`, `scripts/local-inji-smoke.mjs`.

| Confirmed existing setting | Value / qualification |
| --- | --- |
| Browser Web and proxied Mimoto | `http://127.0.0.1:18093`, Mimoto under `/v1/mimoto` |
| Direct host Mimoto / synthetic login | `http://127.0.0.1:18099` / `http://127.0.0.1:18095` |
| Login OAuth callback | Web origin + `/v1/mimoto/oauth2/callback/google` |
| Certify metadata | `http://127.0.0.1:18090/v1/certify/.well-known/openid-credential-issuer`; current working control is SD-JWT |
| Verify request/result | `http://127.0.0.1:18081/v1/verify/vp-request`; `/v1/verify/v2/vp-results/{id}`; existing control uses Presentation Exchange |
| Web / Mimoto / Certify / Verify | `0.17.0` / `0.22.0` / `1.0.0-alpha.1` / `0.18.2`; known image digests are in the profile fixture |
| Protocol draft and JSON-LD credential profile | Unreported / unconfirmed; do not copy hosted Land Registry settings into this stack |

Person 4 must provide the joined browser/container endpoint sheet, canonical issuer metadata and audience, supported JSON-LD configuration/type URI and grant, registered issuance client ID/alias and callback, Mimoto token endpoint, issuance auth audience/token endpoint, verifier identity/trust entry, local logo and any required DataShare/key services. The login callback above is **not** evidence of an issuance-client redirect registration. Container requests cannot use host `127.0.0.1` to reach another container.

Apply the catalog through Person 4's runtime-generation/staging layer only after validating these bindings against the pinned Mimoto release. Replace every `__PERSON4_*__` placeholder and enable the entry only after metadata/profile checks. The existing preparation script always writes `{ "issuers": [] }` and `{ "verifiers": [] }`; manually editing generated temp files will be overwritten on restaging. No staging script or Compose edit is made here. The recorded aggregate `HSMHealth: DOWN` is unresolved for credential operations even though wallet login/unlock succeeded.

## Person 1 capture handoff

Current sources are `docs/CAPTURE_CONTRACT_PROPOSAL.md`, `docs/PERSON2_LIVE_CAPTURE_HANDOFF.md`, `docs/CAPTURE_PROXY_ADR.md`, and `apps/bff/src/capture/{tagging,live-bridge,hub}.ts`.

- Existing browser observations use `actorFrom: browser`, `actorTo: mimoto`, `request.source: live_bridge` (or sanitized `har_import`), and `request.capture.ruleId: mimoto-wallet-credential | mimoto-wallet-presentation`. Run/step/exchange IDs and sequencing come from the BFF, not the browser test.
- Existing presentation correlation compares a run-scoped HMAC of Verify's request URI for Mimoto presentation or state for direct-post. Never send raw HAR to the BFF, export its correlation master key, substitute timing, or derive a verdict from a 2xx transport response.
- `request.publicView`/`response.publicView` expose only bounded public summaries; `request.capture` carries provenance/rule metadata. The existing UI renderer already handles them; no new shared schema is introduced.
- The canonical local forwarding proxy is not implemented in the inspected tree: `CaptureHub` is an attribution prototype, not a listener/forwarder. The hosted browser bridge is not a substitute for observing Mimoto's server-side calls.
- **Missing:** final server-hop actor labels/rule IDs, canonical proxy/public/upstream URL mapping, permitted-origin deployment settings, lease/run attribution and correlation interface, and adversarial persistence/API/socket proof. Until supplied, downstream Certify and Verify remain `not_observed`. Person 4 must not route traffic through an unreviewed proxy.

## Integrator handoff — existing blockers, no guard bypass

1. `apps/bff/src/assisted.ts` accepts only HTTPS links for wallet, offer, Certify and Verify. The published local endpoints are HTTP loopback. `apps/bff/src/presentationCorrelation.ts` also requires HTTPS request/launch URLs, and `apps/web/src/lib/assistedActions.ts` rejects HTTP action links. Decide canonical local TLS with Person 4 or narrowly designed loopback support with Person 1. Never permit arbitrary HTTP, weaken global validation, rewrite signed URLs or bypass TLS verification.
2. The existing assisted run supports only JSON-LD and `collab.ts` creates DCQL requests at `/v2/vp-request`; the pinned local Verify control uses Presentation Exchange at `/vp-request`. Metadata paths also differ from the hosted profile. The integrator/protocol owner must supply a tested matching JSON-LD adapter/profile before Phase 2; these are not fixture values to guess.
3. SD-JWT Web is blocked by the playground selector **and** assisted backend independently of actual wallet support. Phase 2 must separate these restrictions from an observed pinned-wallet unsupported point. No SD-JWT attempt or verdict is claimed in Phase 1.
4. The integrator owns root package commands, BFF/API/shared-type changes and final aggregation. Person 4 owns Compose/staging and CI wiring. Person 2 supplies these helpers, fixtures and test commands without overlapping those files.

## Phase 2 readiness checklist

- [x] Disabled catalog template grounded in the pinned upstream field names.
- [x] Existing endpoint/version facts recorded; unknown joined bindings left explicit.
- [x] Reusable local login/unlock, issuer selection and refresh helpers, with offline tests.
- [x] Opt-in test configuration isolated from existing browser smoke and auth artifacts.
- [x] Published browser capture contract consumed without claiming server hops or acceptance.
- [ ] Person 4: joined endpoint sheet and working JSON-LD issuer/auth/client/keystore/trust/DataShare configuration; prove catalog discovery and resolve credential-operation health blockers.
- [ ] Person 1: canonical local capture proxy and safe correlated server-hop contract/leak tests.
- [ ] Integrator: approved local action-URL policy, matching JSON-LD issuer/Verify adapter and managed-run correlation.
- [ ] Run the optional live shell check against Person 4's provisioned wallet. Not executed as Phase 1 fixture evidence.
- [ ] Phase 2: real local issue → refresh → present → independent Verify result under one managed run, then separately attempt SD-JWT. All remain not tested here.

## Verification performed

- Focused profile/catalog/privacy unit tests: 12 passed.
- Offline browser helpers: 5 passed; 1 real local-shell test skipped explicitly. No Docker, Collab or actual wallet was used for these fixture results.
- Full Web unit suite: 72 passed.
- Local-browser TypeScript and normal Web TypeScript: passed. The shared package's existing generated declarations were stale; rebuilding the existing package fixed the unrelated `RunSummary.recordKind` errors. No shared source was edited.
- Default browser discovery: the original 4 smoke tests only; local tests are excluded. Existing default smoke cases were not re-executed in this phase.
- Repository secret audit and tracked diff whitespace checks: passed.

The initial Phase 1 implementation did not create branches, commits, pushes or merges. A subsequent user request authorizes publication to `main` through the existing reviewed-PR workflow.

## Dependency recheck before publication — 26 October

After fetching all configured origin branches, `main` remains at `3302953`. Person 4 has published `cd8d185` (endpoint sheet), `4b23c0b` (opt-in Compose), `a357c29` (smoke command), and `ad6a057` (handoff) on **`person4/packaging-ci`**, not yet merged into main. Inspect that branch's `deploy/ENDPOINTS.md`, `deploy/endpoints.json`, `deploy/docker-compose.local-full.yml`, and `scripts/smoke-local-full.mjs`.

- The public origins and pinned versions agree with this Phase 1 profile. Person 4 has supplied an endpoint sheet and staging/smoke code; this recheck is source inspection, not a successful deployment execution.
- That branch explicitly leaves Web issuance/presentation `not_tested`, the local issuer catalog unconfigured, and the capture hook disabled. Its full-local Compose does not itself prove a functioning JSON-LD wallet journey. JSON-LD client/profile/trust/DataShare bindings are still missing.
- The endpoint sheet also needs clarification: Certify/Verify `containerOrigin` values use host loopback, which cannot identify a different container; its Verify result URL says GET while the working control uses POST. Resolve these before using the sheet as a joined protocol contract.
- No new Person 1 proxy/contract implementation was found on the fetched main or configured remote branches. Main's `CaptureHub` remains a non-forwarding attribution prototype. Unpushed/local teammate work cannot be assessed from this checkout.

**Phase 2 readiness remains blocked**, specifically by the working JSON-LD deployment bindings, canonical server-hop proxy/correlation contract, and integrator URL/protocol adapter changes listed above. Person 4's progress reduces the documentation/setup gap but does not close these gates. Do not merge their branch automatically as part of Person 2 publication.
