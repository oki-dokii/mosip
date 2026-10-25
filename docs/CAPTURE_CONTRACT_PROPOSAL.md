# Capture integration contract and owner handoff

Updated 22 October 2026. The original optional `Exchange.decoded` proposal was replaced with additive JSON-envelope fields so Person 2 and the shared schema need no simultaneous edits. The integrator applied the small `app.ts` seam for the import response and ingress guard. No database migration, shared type change, driver change, Compose change or web source edit is required by this capture implementation.

## Implemented contract

```ts
// Existing Exchange.request and Exchange.response remain unknown/JSON.
interface PublicProtocolView {
  schemaVersion: 1;
  authenticity: "not_verified";
  items: Array<{ kind: string; summary: Record<string, unknown> }>;
}
// Imported request/response JSON envelopes:
// { source: "har_import", headers, body, publicView?: PublicProtocolView }
// request.capture additionally contains:
// { schemaVersion: 1, ruleId, why, redactionCount, timingKnown, observedAt }

// POST /api/v1/runs/:id/capture/har response (additive):
// { imported, skipped, skippedReasons, coverage, gaps }
// coverage: [{ stepKey, state: "captured" | "missing" | "not_observable", count, reason }]
```

`skippedReasons` has counted codes: `malformed_entry`, `unfinished_request`, `unsupported_method`, `untagged`, `duplicate`; a persistence conflict can add `persistence_conflict`. Missing keys mean zero. Malformed top-level HAR, cross-run import, unapproved origin and unsafe size are hard failures. Preparation completes before any write. The endpoint recomputes coverage from stored browser exchanges; driver-only exchanges do not count as browser observation.

Public summaries are projected from a fixed vocabulary before persistence. Unknown schema/claim names are withheld. Request objects and proof headers are decoded, not cryptographically validated. No raw signed object, complete credential, subject value, salt, nonce, certificate or private key is stored in the view. Arbitrary metadata `kid` values are represented only by a presence flag. Issuers keep an allowlisted origin or DID method. This is deliberately a narrower projection than a raw inspector.

Tagging is an ordered, method-specific endpoint table with a rule reason. Unknown routes are skipped as untagged, not assigned to a guessed step. The eSignet fixture now uses an explicit token endpoint. HMAC correlation tags apply only to sufficiently long HAR values and are scoped to the run and current BFF process; short codes/private key parameters use plain masks. `redactionCount` counts unique masked paths, not credential risk or bytes removed. The existing driver `redact()` signature and plain-mask default are preserved.

## Proof and current limits

[CAPTURE.md](CAPTURE.md) links a four-service synthetic HAR, saved public-metadata exchange IDs, per-step boundaries, filter usage and database/API/socket checks. `har.test.ts` checks that useful projected VC types and verifier booleans survive while canaries do not appear in stored rows, API output or Socket.IO summaries. `filter.test.ts` removes hundreds of background calls and verifies that its reconstructed safe HAR can be imported. Decoder, rule, limiter, HMAC and attribution tests cover their separate boundaries.

The browser pass remains synthetic. Live Inji Web is **unobserved**. Coverage and public decoding cannot close FR-40's every-exchange claim or prove A1/A2. The canonical local proxy is a [conditional design](CAPTURE_PROXY_ADR.md), with a disabled attribution module and no forwarder.

## Handoffs without overlapping edit surfaces

| Owner | Concrete next task | Boundary |
| --- | --- | --- |
| Person 2 | Optionally render `request.publicView`, `response.publicView`, `request.capture`, and import `coverage`; show `not_verified` and timing-unknown labels. Add a dedicated live-wallet HAR when a wallet flow exists. | Existing JSON inspector remains compatible. Do not turn a captured step into a passed step. |
| Person 3 | Maintain the [machine-readable gap snapshot](../submission/gaps.json), add exact spec/profile references for each new scenario, and reproduce issuer-method/padded-DID leads with one changed variable. Privately triage security-impact findings. | Only independently reproduced observations are confirmed gaps here. Gap snapshots with no matching run/cell explicitly say so. |
| Person 4 | Add the existing secret audit to hosted CI before build/artifact publication, and run the PostgreSQL capture check against the job database if available. Supply canonical public-URL/TLS/upstream configuration before any proxy work. | Workflow, Compose and service settings remain Person 4's files. |
| Integrator | Apply handoffs serially on `main`; keep versions, acceptance claims and final evidence consistent. | No branches or contributor-identity rewriting. |

Suggested Person 4 CI step after install (not yet wired by this change):

```yaml
- name: Evidence and fixture secret audit
  run: pnpm audit:secrets
```

This scan now covers text fixtures throughout the monorepo and `submission/evidence/`. It checks both sensitive filenames and high-confidence content, including literal token/private-key fields; it never prints their values. The reviewed synthetic HAR filename is the sole filename exception and remains content-scanned. `SECURITY.md` describes non-goals and private disclosure.

Contract-drift diff and a public issue-draft exporter remain stretch work. Any future exporter must honor private-disclosure states and must not turn unverified leads or private security findings into public issues.
