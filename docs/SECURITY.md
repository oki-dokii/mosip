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

The capture parser never fetches user-selected URLs. Current driver origin controls, guarded context loading, local forwarding and CSP are described below; they do not establish network-level SSRF containment for every official component. The older CaptureHub remains a separate prototype and is not the active forwarder's distributed coordination mechanism.

## Reporting a possible vulnerability

Do not publish a working exploit, credential, live token, or sensitive acceptance-bypass reproducer in a public issue or submission fixture. First reproduce with synthetic data on an authorized pinned environment; record versions and a sanitized summary. Send a minimal private report to MOSIP/the affected project's published security contact through the organizer or private advisory channel. Ask the team to confirm the destination if no private channel is published. Do not invent a contact address or assume a public issue is private.

Holder-binding failures, nonce/replay acceptance, credential forgery and trust bypasses require private triage before public issue drafts. Public gap records should contain a non-exploitative summary, disclosure state and sanitized evidence references after that review. External claims are leads until independently reproduced. No security report has been sent automatically by this work.

## Implemented runtime controls — 26 October 2026

The earlier prototype-only paragraph is superseded by the
[canonical local capture contract](PERSON1_LOCAL_CAPTURE_HANDOFF.md). The local
forwarder now has explicit fixed upstreams, route/method allowlists, bounded I/O,
no redirect following and a run lease validated before sanitized persistence.

### API/socket access and HTTP policy

- The ordinary Node server binds `127.0.0.1` by default. Compose explicitly binds
  inside its container while publishing its host port on `127.0.0.1` only.
- `PLAYGROUND_ACCESS_TOKEN` enables a shared operator gate for APIs and Engine.IO.
  Set a randomly generated secret of at least 32 characters outside Git. CLI callers
  may use Bearer auth. Browsers can first open an API route directly and sign in via
  HTTP Basic with username `playground` and the secret as password, then use the
  same-origin proxied app. The public health endpoint contains only service metadata.
- `PLAYGROUND_PUBLIC_MODE=true` refuses startup without that token. This is an
  operator gate, not tenant authorization, user accounts or a production identity
  service. Use HTTPS at the reverse proxy before exposing it beyond loopback.
  Exposing a container port/network is an administrator deployment decision;
  `PLAYGROUND_BIND_HOST` alone does not configure a TLS/public deployment.
- Authenticated mutation requests with a foreign Origin are rejected; forwarded
  headers do not establish trust. The capture control channel retains its separate
  generated bridge token instead of exporting a user password to collectors.
- JSON APIs set nosniff/no-referrer/frame-denial and a restrictive CSP. The packaged
  nginx UI sets a self-hosted-script CSP; inline styles and WebSocket connections
  remain allowed for React styling/Socket.IO. Vite development is not that nginx
  production policy. Browser and Docker smoke tests verify the packaged app separately.

### Outbound requests and JSON-LD

- Credential-selected token/credential/request/result URLs must stay on exact
  administrator-configured issuer/auth/verifier/mock origins. URL credentials,
  fragments, unsupported schemes and off-origin metadata URLs are refused before
  transport. Explicit HTTP mock/container origins remain available for the demo;
  there is no wildcard localhost/IP exception for a credential-selected URL.
- Protocol requests never follow redirects and responses are capped at 2 MiB.
  Cookies remain scoped to the authorization-server origin.
- Reference-wallet JSON-LD signing uses a context loader restricted to the listed
  W3C/security/project context origins, validating every redirect, limiting four
  attempts, 15-second fetch timeouts and 256 KiB documents. Nested contexts pass
  through the same guard. Add a reviewed context origin in code/tests when needed;
  do not disable the check to make an unfamiliar credential pass.
- This is an application origin policy with normal TLS verification, not DNS/IP
  pinning or network egress containment. Configured origins are trusted operator
  inputs. It does not harden the official Java components' own document fetchers.

### Retention, safe reset and backup

Maintenance is an offline operator CLI, not an unauthenticated reset endpoint.
`DATABASE_URL` must point to the intended persistent playground database; stop new
writes if a consistent backup is required. Outputs contain sanitized repository
records, not wallet runtime secrets, PKCS12 files or a complete Inji-stack backup.
Do not publish a backup without review. No automatic retention is enabled.

```bash
# DATABASE_URL is already set privately; choose an existing private output directory.
pnpm store:maintain backup --backup /private/tmp/playground-backup.json
# Preview completed records older than the cutoff; no deletion:
pnpm store:maintain prune --before 2026-10-01T00:00:00.000Z
# Apply only with a new backup path; existing files/symlinks are refused:
pnpm store:maintain prune --before 2026-10-01T00:00:00.000Z --apply --backup /private/tmp/playground-before-prune.json
```

Backups use exclusive creation, mode `0600`, a 50 MiB/5,000-run cap and an external
repository path. The backup is a best-effort multi-read snapshot, not a transactional
restore format. Retention defaults to dry-run; apply requires a successful new
backup. It deletes only terminal runs older than the past cutoff, preserving active,
recent and immutable archived A1 records. It does not run on a schedule or delete
wallet data. No pruning was performed against the team's actual run history during
implementation; destructive tests use an isolated disposable PostgreSQL database.
