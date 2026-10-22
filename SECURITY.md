# Security and evidence handling

This is a local development playground for synthetic credentials and test identities. Keep real identity data, college IDs, production tokens, signing keys, raw real-session HARs and authentication environments outside this repository and submission exports.

## Capture controls

- The HAR endpoint requires `application/json`, caps the parsed body at 2 MiB and 100 entries, and caps each body at 128 KiB. Origins must exactly match the configured allowlist. It does not fetch URLs in a HAR or decoded object.
- Import attempts are limited to 10 per minute per transport peer in each BFF process. Peer identity comes from the socket; changing `X-Forwarded-For` does not reset a bucket. At most 1,024 buckets are retained. Capture errors return stable codes, not the request body, parser error or raw upstream material.
- Invalid individual entries, unfinished requests, unrecognized routes and duplicates are counted separately. Unsupported origins and oversized recognized bodies reject the import before storage. Unknown routes stay untagged; no arbitrary URL is saved as a fallback.
- Secret-bearing fields are masked before repository writes or Socket.IO emission. Public summaries are projected in memory from a bounded vocabulary. They never include complete JWTs, credentials, signatures, disclosure values/salts, subject claims, private JWK members or certificates.
- Long HAR values may have a per-run HMAC correlation marker. The server generates an ephemeral 256-bit master key, derives a key per run and stores neither key. Bearer prefixes are removed before correlation. Short values, authorization/transaction codes, OTPs and private JWK parameters use plain masks. Tags change across BFF restarts; they are not portable evidence or hashes a reviewer can recompute. The default driver `redact()` call still uses plain masks. Secret identifiers accept mixed case/separators; values under non-ASCII identifiers are conservatively masked to prevent confusable-key bypasses.
- Exchange IDs are derived from public HTTP metadata plus an occurrence index, never from raw token-bearing URLs. Unknown HAR body/query field names are generalized to numbered `[field:n]` placeholders; unknown query names use `[field]`. Reimporting the same ordered HAR is idempotent. Distinct calls with identical public metadata are numbered within an import; splitting or changing such a collision group can change its IDs. Older captures retain their stored IDs.
- The local filter reconstructs an output HAR from sanitized exchanges and writes a new file with owner-only permissions. It never copies raw input entries, overwrites the source, uploads data or prints body contents. Review the sanitized output and keep source HARs outside git.
- `pnpm audit:secrets` scans evidence, fixture and script text (including test sources), plus sensitive filenames. It recognizes known synthetic canaries and redaction markers. Its findings contain paths, line numbers and rule names only. The one reviewed synthetic HAR filename is exempt from the filename rule, but its contents are scanned.

## What this does not protect against

The API has no login, authorization model or tenant isolation. CORS is not access control. Do not expose it as a public multi-user service without an authentication and deployment review. The rate limit is per process and does not replace a gateway limit or prevent every denial of service. A shared NAT peer shares one bucket.

A public decode is not signature, certificate, issuer-trust, holder-binding, revocation or replay validation. Its `authenticity: not_verified` label applies even if the payload contains a claimed `valid` outcome. A HAR records what a client exported, not a trusted packet capture or proof that a wallet stored a credential. Browser coverage cannot establish server-to-server, native-wallet, wallet-local, encrypted, omitted-body or out-of-window exchanges.

Field and value scanning is defense in depth; it cannot recognize arbitrary personal information or a short secret hidden under an unrelated key. Allowlisted protocol vocabulary is conservative and may omit unfamiliar legitimate schema names. Source HAR export files remain sensitive. The text audit does not inspect binary artifacts, git's entire history, encrypted archives, cloud folders or credentials on another machine. Synthetic-only use remains required.

The capture parser never fetches user-selected URLs. That property does not establish SSRF protection for every existing issuer/wallet/verifier driver. A future proxy/fetch layer must have an independently tested fixed-upstream/SSRF policy before release. The capture hub is only an attribution prototype; no proxy, stack public-URL changes, CSP deployment or distributed claim store is provided by it.

## Reporting a possible vulnerability

Do not publish a working exploit, credential, live token, or sensitive acceptance-bypass reproducer in a public issue or submission fixture. First reproduce with synthetic data on an authorized pinned environment; record versions and a sanitized summary. Send a minimal private report to MOSIP/the affected project's published security contact through the organizer or private advisory channel. Ask the team to confirm the destination if no private channel is published. Do not invent a contact address or assume a public issue is private.

Holder-binding failures, nonce/replay acceptance, credential forgery and trust bypasses require private triage before public issue drafts. Public gap records should contain a non-exploitative summary, disclosure state and sanitized evidence references after that review. External claims are leads until independently reproduced. No security report has been sent automatically by this work.
