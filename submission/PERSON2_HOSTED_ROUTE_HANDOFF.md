# Person 2 hosted route discovery — 23 October 2026

Fresh Chrome Network recording of dedicated-account Land Registry Registration Receipt issuance and presentation, processed locally. Only method, origin, ID-masked path and current rule ID are retained in the [route artifact](evidence/person2/hosted-route-discovery.json). No query strings, headers, bodies, HAR, account IDs or credential data are included.

| Method | Origin | Observed path pattern | Current rule ID |
|---|---|---|---|
| POST | https://injiweb.collab.mosip.net | `/v1/mimoto/wallets/{id}/credentials` | `null` |
| POST | https://injiweb.collab.mosip.net | `/v1/mimoto/wallets/{id}/presentations` | `null` |
| POST | https://injiverify.collab.mosip.net | `/v1/verify/v2/vp-session-request` | `null` |
| POST | https://injiverify.collab.mosip.net | `/v1/verify/vp-session-results` | `null` |

The collector masks even static segments absent from its public-segment list (`wallets`, `vp-session-request`, `vp-session-results`). The table preserves these observed static route names and replaces actual wallet UUIDs with `{id}`. Rule matching was checked against `766bb55`: all four rows are currently untagged.

## Public credential type

The hosted Verify request's public type-values configuration contained this URI:

```text
https://inji.github.io/inji-config/contexts/landregistry-registration-receipt-context.json#RegistrationReceiptCredential
```

Use this observed value to configure `VERIFY_LDP_TYPE_VALUES_JSON` for the matching Registration Receipt request. No complete request payload is retained here. The exact Certify issuer/configuration ID still requires public-profile confirmation.

## Capture owner follow-up

1. Add an explicit rule for the observed wallet-scoped credential POST, retaining browser-to-Mimoto provenance and `downstreamCertifyObserved: false`.
2. Handle the observed wallet-scoped presentation POST as a distinct browser-to-Mimoto transport checkpoint. **No browser-to-Verify direct-post was visible in this recording.** Do not relabel the Mimoto call as direct-post evidence or infer a server-to-server Verify call.
3. The recorded Mimoto presentation requests did not contain a top-level state scalar for the current collector. Define an approved run-correlation mechanism for this actual route; the existing direct-post/state collector cannot advance it unchanged. Keep raw request/credential data out of persisted records and retain an independent Verify result requirement.
4. Recognize the observed Verify session-request/results routes where appropriate. Route recognition alone does not establish compatibility with the existing backend-created request/result adapter; validate that separately during the managed run.

The current bridge's correlated-direct-post synthetic tests passed, but those synthetic paths differ from this hosted browser flow. A managed live run was not started with these unmatched routes; it would not receive the required checkpoints. The earlier manual hosted Valid evidence remains independent; this discovery recording is not a new managed-run result or A1 sign-off. The final screen returned to Verify without a newly observed visible verdict, so no additional Valid result is claimed from this discovery attempt.

## Capture-owner update after this recording

The four path patterns now have explicit rules: `mimoto-wallet-credential`, `mimoto-wallet-presentation`, `verify-session-request`, and `verify-session-results`. The route artifact above remains an immutable record of what the **earlier** `766bb55` rule set returned. For Mimoto presentation, the local collector accepts a matching Verify `request_uri` only from that same POST's top-level body field, URL query, or same-origin `/user/authorize` Referer, then sends it transiently to the BFF for a run-scoped HMAC tag. A missing or conflicting URI increments `request_uri_unavailable` and leaves that checkpoint unverified. The browser recording has not yet established whether any such source is present in the hosted flow. Verify session-result traffic is recorded as browser context, while the playground's independent verifier driver remains the source of the final verdict.
