# Capture contract proposal for Person 1 handoff

Prepared 2026-10-22 after reviewing the passive HAR importer and driver redactor. This is a proposal, **not an implemented `Exchange` schema change**. Person 1 owns capture and redaction; the integrator will apply any shared type/API change after reviewing a fixture and tests. Person 2 owns inspector rendering, and Person 4 owns CI wiring.

**Order of work:** Person 1's immediate four-service synthetic HAR handoff is complete in `77be60a`; [CAPTURE.md](CAPTURE.md) links the fixture, reproducible exchange IDs, boundary list, and negative redaction-test output. HAR timing/base64 tolerance and redactor hardening landed in `9bd766a`. The schema, decoded view, and dynamic per-step coverage ideas below remain proposed work.

## Current risk and boundaries

`apps/bff/src/capture/har.ts` keeps JSON/form body shape but masks nearly every scalar, while `apps/bff/src/redaction.ts` recursively masks only named fields. Both paths eventually feed `Exchange` records, so a driver can accidentally persist a complete credential or JWT under an unexpected key. The importer also rejects a whole HAR when Chrome records `time: -1` or `status: 0`, and its 100-entry cap requires manual filtering. These are code observations; no real Inji Web HAR was tested in this review.

## Proposed sanitized exchange shape

Keep existing `Exchange.request`, `Exchange.response`, and `redactions` for compatibility. Person 1 should submit an example before the integrator adds an **optional**, versioned `decoded` field:

```ts
interface PublicProtocolView {
  schemaVersion: 1;
  request?: Record<string, unknown>;
  response?: Record<string, unknown>;
}
// Exchange.decoded?: PublicProtocolView
```

Only explicit public fields may appear: format, response type/mode, grant type, credential configuration **names**, proof type/algorithm, VC type, verifier outcome, stable error code, and JWT header `alg`/`typ`/public `kid` after bounded validation. `client_id`, issuer, `response_uri`, and other URLs should be normalized to origin plus route template with query and fragment masked. Presentation definitions may retain field names and type/format constraints; predicates or values that can identify a person remain masked. SD-JWT disclosure **claim names** may be shown only after parsing and allowlisting; values remain masked. Unknown fields default to masked. The inspector should label this as a decoded public summary, never as a full raw message.

One sanitizer policy should run before database writes, API responses, and Socket.IO events. Normalize key spelling and case so `pre-authorized_code` and `pre_authorized_code` have the same rule. Mask credential/token/OTP/cookie/JWK-private fields and scan scalar values for compact JWTs, PEM private keys, credential-offer URIs, and long opaque strings, including values under unknown keys. A value-pattern scanner is defense in depth; it does not make an arbitrary allowlist of fields safe. Never record a private-key parameter (`d`, `p`, `q`, `dp`, `dq`, `qi`) or a complete VC.

## Coverage contract

Return a per-step list separate from `Exchange` with `stepKey`, `state` (`captured`, `not_observable`, or `missing`), count, and reason. A server-to-server or native-wallet boundary should be `not_observable` for browser HAR rather than inferred from an empty list. An unmatched but allowlisted path should increment a count; the route table should use service, method, path pattern, and step in that order, with one test per row.

## Acceptance examples

- A real-shaped **synthetic** HAR with hundreds of static assets is locally filtered to the allowlisted protocol calls before upload. The raw HAR never leaves the user's machine or enters git. The importer skips malformed/background entries with counted reasons, sorts valid entries by time, and handles `time: -1`, `status: 0`, and base64-encoded content explicitly.
- Known public protocol fields appear in the inspector's decoded view, while canary tokens and personal fields do not appear in stored rows, API output, or Socket.IO payloads. Reimport remains idempotent.
- The report states which steps were captured or unobservable. The UI does not claim a complete wallet journey from HAR alone.
- The integrator adds the optional field only after Person 1's fixture and Person 2's rendering contract agree; Person 4 then enables the tests in CI.

The independent `pnpm audit:secrets` check scans tracked/non-ignored artifact filenames plus documentation/evidence text. It does not inspect binary content and is not a substitute for write-time sanitization. Person 4 can add it to CI after reviewing the baseline.

## Requirement trace

The current HAR path cannot by itself satisfy SRS FR-40's **every exchange** claim: it sees browser traffic after a run and omits server-to-server, native-wallet, encrypted, and out-of-window boundaries. A per-step coverage list makes this limit visible, but the acceptance claim remains open until those other boundaries are observed or the requirement is revised with the team. FR-42/A3 calls for useful offer, token, presentation definition, VP token, and result detail; body-shape-only HAR records do not satisfy that inspector detail. The decoded public view is a proposed safe partial remedy; complete signed or secret-bearing objects still cannot be shown unmasked under FR-43/A5. The current capture test checks in-memory repository storage and API output; it does not test PostgreSQL rows or Socket.IO payloads.
