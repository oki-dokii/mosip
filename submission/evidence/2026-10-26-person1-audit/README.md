# Person 1 privacy and integration audit — 26 October 2026

Audited source: `71307a949dccf600bda90d89280f88589192cc25`.
This is a fresh **local clone on the same Mac**, not an independent-machine rehearsal.
The final documentation commit adds this report; it does not change the audited source.

## Privacy review

- Fresh clone: 460 tracked filenames checked by `node scripts/audit-secrets.mjs`;
  documentation, evidence, fixtures and scripts passed its content-pattern checks.
  Raw-session HAR, private-key filenames and student-ID filenames are prohibited;
  the single committed synthetic HAR specimen is the scanner's explicit exception.
- All 26 tracked raster screenshots were visually reviewed. No apparent private
  account details, passwords, OTPs or raw credentials were observed. The account
  display alias in `stored-after-refresh.png` was explicitly confirmed by the user
  as synthetic and intended for public release. Its original pixels are retained.
- All three images embedded in the draft deck match already reviewed screenshots
  byte-for-byte. The user confirmation also applies to its embedded alias image.
- The historical Android QR image was decoded locally. It contains an inline offer
  with no pre-authorized grant, issuer-state field or offer reference. Only these
  metadata flags were exported; no raw QR payload was printed or committed.
- The 127.48-second silent draft video was sampled at 0, 10, …, 120 seconds (13
  frames). No apparent private/authentication values were observed in those samples.
  This is **not** a full video review; it has no audio stream. Person 2 still owns
  final narration, full playback and slide-claim review.

[The manifest](privacy-manifest.json) records SHA-256 hashes, reviewed paths and
scope. Reviewed images and video match the exact fresh clone. Historical screenshots
remain dated evidence: this review does not validate every old selector/version label.
This audit does not inspect all Git history, external cloud folders or separate
student-ID uploads. Pattern matching cannot prove the absence of every secret.

## Engineering verification

| Check | Result |
| --- | --- |
| `pnpm typecheck` | Passed |
| `pnpm build` | Passed |
| `pnpm test` | 435 passed; five optional database checks skipped |
| Disposable PostgreSQL retention test | Three maintenance tests passed, including terminal-only cascade deletion |
| HTTP/Engine.IO operator gate, including private bridge isolation | Two tests passed; latest targeted run includes bridge-route checks |
| `pnpm --filter @playground/web test:browser` | All 17 browser checks passed on alternate loopback ports |
| Aggregate report consistency | Passed in the fresh clone |
| Source-tree filename/text secret audit | Passed; 461 tracked/non-ignored paths at verification time, including the deleted tracked roadmap before commit |
| Fresh-clone filename/text secret audit | Passed; 460 tracked paths |
| `pnpm demo:docker` | DEMO PASS; six mock scenarios matched expectations |
| Production nginx UI in Chromium | Run control and API health available; zero CSP violations and zero page errors |

The Docker checks used the current source workspace with audit documentation pending,
not the fresh-clone environment. They exercise mocks and the initial packaged UI,
not a new real-wallet run. Docker temporarily stalled during image unpacking on
low disk space, then completed successfully; no shared Docker data was pruned.

The disposable retention-test database was removed after verification. The live
playground database was not pruned. The database tests demonstrate retention behavior;
no complete-stack backup/restore or independent-host recovery is claimed.

## Open owner checkpoints

Person 2: final inspector/sign-off and full deck/video review. Person 3: private
security reports and further protocol observations. Person 4: clean installation on
another machine and hosted CI on the final commit. Deadline, team name and submission
links remain user-owned pending inputs. No email or upstream issue was sent here.
