# Capture decision: passive browser capture and canonical local forwarding

Decision accepted 22 October; implementation checkpoint 26 October 2026.
Browser HAR/live metadata capture remains the hosted Collab path. The canonical
local forwarder is now implemented and has a clean-source managed wallet pass.
See [the current contract](PERSON1_LOCAL_CAPTURE_HANDOFF.md) and
[acceptance evidence](../submission/evidence/2026-10-26-managed-local-jsonld/README.md).
Older prototype-only wording is superseded; it is not the current deployment state.

| Capture surface | Observes | Does not establish |
|---|---|---|
| Driver HTTP | BFF request creation and independent verifier result | Wallet storage or unseen wallet/server traffic |
| Browser HAR/live bridge | Recorded browser→Mimoto/Verify transport | Downstream server hops, native traffic or cryptographic validity |
| Canonical local forwarder | Actual configured Mimoto→Certify token/credential and Mimoto→Verify direct post | Unrouted traffic, by-value request fetches, wallet encryption or production authorization |

```mermaid
sequenceDiagram
    participant W as Mimoto / synthetic wallet
    participant P as Canonical local bridge
    participant B as Local BFF
    participant I as Pinned Certify / Verify
    participant D as Run repository
    P->>B: Snapshot exclusive active-run lease
    W->>P: Canonical protocol request
    P->>I: Fixed-upstream bounded forwarding
    I-->>P: Protocol response
    P->>B: Name/path projection + private state scalar
    B->>B: Validate projection; HMAC state with backend run key
    B->>D: Persist sanitized exchange before event emission
    B-->>P: Saved exchange ID
    P-->>W: Original credential / VP transport response
```

No shared Collab configuration or host TLS trust is modified. Local identifiers,
DIDs, redirects and audiences are configured before issuance. No `/tap/` rewrite or
TLS validation bypass is used. The declared synthetic IAR and DID relationship
adapters remain explicit; byte-preserving capture is not a claim that these
adapters are stock upstream behavior. Host ports are loopback-bound; the internal
TLS/DID bridge is reachable only on the configured Docker networks.

The forwarder uses fixed upstreams, method/path allowlists, body/response caps,
timeouts, no redirect following and an authenticated control channel. One exclusive
run lease prevents ambiguous concurrent attribution. Expired/cancelled observations
fail closed. HMAC keys stay in backend memory. Public capture includes no raw
headers, credentials, authentication tokens, state or real HAR.

`capture/hub.ts` remains an older isolated attribution prototype; enabling its flag
alone does not start the implemented forwarder. Follow the current handoff commands.
