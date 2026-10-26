# Final human checks — Bhole Chature

These checks remain open. Do not replace their results with automated checks or a second folder on the development Mac.

## Independent-machine rehearsal

A teammate who did not write the setup should use a different machine and the exact candidate commit supplied by the integrator.

1. Record reviewer, OS/architecture, Node, pnpm and Docker versions, and commit SHA.
2. Clone the repository, check out that SHA and follow README prerequisites without undocumented fixes.
3. Run `pnpm install --frozen-lockfile`, `pnpm typecheck`, `pnpm test`, `pnpm build`, `pnpm audit:secrets` and `pnpm demo:docker`.
4. Record actual commands, exit status and the six-case mock outcome. If the official local stack is feasible, separately follow its documented setup and wallet acceptance commands; a mock pass is not a real-wallet pass.
5. Save sanitized output or the exact blocker. Do not export `.env`, browser state, credentials, tokens, raw HAR or unrestricted service logs.

Reviewer: **pending**. Machine: **pending**. Commit: **pending**. Outcome: **not performed**.

## Video and pitch review

Listen through the entire current four-minute video, enable English captions and inspect slide/screenshot readability. Verify the team roster, latest counts, same-run screenshot provenance, report status and declared adapters. Check on the device/player intended for judging. The voice is synthetic; replacing it with a human voice-over requires a teammate recording. The wallet segments are recorded evidence stills, not uninterrupted live footage.

Reviewer/player/date: **pending**. Full playback/audio/CC outcome: **not performed**.

## Delivery

Upload the current deck, PDF and video (not `pitch/archive/`) to the [team's Drive folder](https://drive.google.com/drive/folders/1fy-bgTacPqOQm-p_LHGR27bFzh2xguVG). Open its links in a signed-out/incognito session. Record the final URLs and access check. Each student provides their college ID privately. Deadline and final email remain with the team lead.
