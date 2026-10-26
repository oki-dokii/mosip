# UI-managed local wallet acceptance — 26 October 2026

Run: **`8fc582b8-9548-4b86-b6b9-7ed67e7ca171`**. Source:
`122e6bd8d0020e828b1450150f1cdd274be255cd`, clean tree. The dedicated capture
backend was restarted from the built source before this run.

The actual playground UI selected Certify / Inji Web Assisted / Verify / JSON-LD,
started a live assisted run and submitted storage confirmation only after the
existing wallet browser helper verified the exact newly issued card after reload.
The presentation helper selected that same card in that same wallet. The backend
captured the server hops and independently polled Verify: **valid**, with credential
and holder proof checks true. UI reload retained the same run. The inspector showed
allowlisted subject names/paths and the distinct server-hop coverage.

| Checkpoint | Evidence |
| --- | --- |
| UI start, UI confirmation, exact-card reload, same wallet/card and independent proof results | [UI checks](ui-checks.json) |
| Persisted steps, exchanges, versions, evaluation and deployment limits | [Unmodified sanitized API report](run-report.json) |
| Browser coverage separate from server observations | [Coverage](coverage.json) |
| Names/paths and privacy counters; no claim values | [Reviewed inspector screenshot](subject-inspector.png) |
| Public image names/digests after the run | [Component snapshot](component-snapshot.json) |
| Browser-native protocol detection, without a credential request | [Capability check](native-browser-check.json) |

## Repeat

Follow [the capture handoff](../../../docs/PERSON1_LOCAL_CAPTURE_HANDOFF.md) to prepare
and attach the local stack. Keep `pnpm capture:local` running on port 4500. Then:

```bash
VITE_ASSISTED_LOCAL_PROFILE=jsonld-0.14 PLAYGROUND_WEB_DEV_PORT=45174 PLAYGROUND_BFF_URL=http://127.0.0.1:4500 pnpm --filter @playground/web dev --host 127.0.0.1
# Separate terminal:
pnpm check:web-managed-ui
```

Optional `LOCAL_ASSISTED_UI_URL` and `LOCAL_ASSISTED_BFF_URL` must be exact host
loopback HTTP origins with explicit ports. The helper stores only reviewed sanitized
exports under the private runtime's `managed-ui-evidence/`; never publish runtime
settings, action URLs, authentication state, full credentials or raw HAR.

## Scope and technical review

- Technical consumer review passed: absent/withheld/truncated subject projections,
  allowlisted paths and values, server/browser separation and HTTP/verdict wording
  are covered by UI tests. This is an automated browser journey, not a human
  screen-reader, physical-phone or team-signature record.
- The component snapshot was taken **after** the run and reports configured image
  references/IDs, not independent binary attestation during execution.
- Browser HAR was not attached. Browser hops stay missing; the Mimoto request fetch
  stays `not_observed` because the request was delivered by value. Storage is based
  on the exact-card reload check, not inferred from HTTP success.
- Synthetic authorization, the declared DID adapter, context-network dependency
  and the generic **unverified** evidence tier remain unchanged. The successful
  observation is not general protocol conformance or a claim that all formats work.
- The browser accepts the checked DC API protocol identifiers. This neither proves
  an installed wallet/provider nor supplies a matching verifier adapter. Current
  local/hosted direct-post profiles have no integrated DC API response path.

The earlier helper attempts hit a UI locator/readiness problem after a real wallet
pass. Those attempts were not promoted to successful UI acceptance. This bundle is
from the corrected complete run and preserves its real run ID.

## UI and delivery validation

[Final automated checks](validation.json), [media hashes and validation](media-validation.json), [dark/Hindi navigation header](dark-hindi-header.png), and [actual browser zoom metrics](zoom-metrics.json). The zoom metric check found no document overflow at 200% and 400%; its headless zoom screenshots were blank, so manual visual zoom acceptance remains open. The header screenshot was visually reviewed.

## Managed-run wallet screenshot

[Wallet after reload](wallet-stored-after-reload.png) was recovered from the synthetic helper output saved at 2026-10-26 05:54:17 UTC, matching this run’s issuance checkpoint; presentation followed at 05:54:29 UTC. It was visually reviewed before publication. The image shows synthetic card titles only; exact-card correlation comes from the helper assertions and run evidence, not visual identification of similar titles.
