# Person 2 handoff: make safe capture evidence visible

Prepared 22 October 2026. Owner: Person 2. Status: contract and backend ready; **UI implementation and browser test remain to be done**. Person 1 has not edited `apps/web/`.

The BFF already stores sanitized `Exchange.request.publicView`, `Exchange.response.publicView` and `Exchange.request.capture` inside the existing JSON envelopes. `GET /api/v1/runs/:id/exchanges` returns them; `POST /api/v1/runs/:id/capture/har` returns per-step `coverage`. No shared-schema or new route is required for the first renderer.

For each selected exchange, show the safe `publicView.items` summary for request and response, `authenticity: not_verified`, the rule ID/reason and redaction count from `request.capture`, and three counters from each public view: `withheldNames`, `truncatedItems`, and `unsupportedKinds`. A zero-item view with an unsupported count should say the format was not decoded. Use the existing raw sanitized JSON inspector as a detail view; do not decode any raw token in the browser.

At run level, show coverage for each step: `captured`, `missing`, or `not_observable`, its count and reason, plus the new `projection` totals for withheld names, truncated items and unsupported kinds. `missing` must not be styled as a verification failure. A captured browser request does not establish that a wallet stored a credential or that a verifier accepted it.

Fixture acceptance: import the committed four-service synthetic HAR, then open a step and confirm public credential/definition names are visible while its canary values, JWTs, disclosure values, nonces and private key fields are absent from the DOM, API and screenshot. Test an unsupported CBOR/mDoc item and unknown `portrait`/`farmer_id` names: the view shows counters instead of an empty unexplained panel. Test keyboard focus and screen-reader labels on the added controls. Keep any real Inji Web wallet presentation labeled unobserved until actual traffic and a verifier result are saved.

Person 1's backend proof is in [CAPTURE.md](CAPTURE.md). Coordinate any desired route/type change with the integrator before editing the shared contract.
