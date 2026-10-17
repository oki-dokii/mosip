# Inji Interoperability Playground: documentation index

A web app where you pick an issuer, a wallet and a verifier, run a live issue → hold → present → verify flow across Inji Certify, Inji Web/Mimoto and Inji Verify (and non-Inji mocks), and see every protocol exchange.

Read in this order:

| # | Document | Answers |
|---|---|---|
| 1 | [PRD.md](PRD.md) | Why are we building this, for whom, in what priority order? |
| 2 | [SRS.md](SRS.md) | Exactly what must the system do? (requirement IDs FR-xx, NFR-xx) |
| 3 | [TRD.md](TRD.md) | How is it built: architecture, stack, team split, day plan, risks |
| 4 | [UIUX.md](UIUX.md) | What do the screens look like and how do they behave? |
| 5 | [BACKEND.md](BACKEND.md) | REST API, WebSocket events, folder layout, driver contracts |
| 6 | [DATABASE.md](DATABASE.md) | Postgres tables, enums, views, data rules |
| 7 | [decisions.md](decisions.md) | Why each choice was made, and what was given up. Also the pending questions. |
| 8 | [flow.md](flow.md) | How code moves between files and functions (entry points, order of execution, call chains) |

Working rules for people and AI assistants are in `../CLAUDE.md`: quiz before changes, log every meaningful decision, keep `flow.md` true.

## Status of this documentation
Design phase, version 0.1, 2026-10-17. `flow.md` describes the **planned** code; its status markers change as code is written.

## Open questions that need a Day-1 spike
P-001 Certify headless issuance flow · P-002 Inji Web presentation support · P-003 `vp_token` shape Verify accepts · P-004 formats supported per version · P-005 local stack or Collab sandbox for the demo. Details are in `decisions.md`.

## Sources used for the Inji API facts
- Inji Verify OpenID4VP endpoints and draft: https://deepwiki.com/mosip/inji-verify/5-openid4vp-implementation
- Inji Verify cross-device flow: https://deepwiki.com/mosip/inji-verify/5.1-cross-device-flow
- Inji Verify SDK: https://npmjs.com/package/@mosip/react-inji-verify-sdk
- Inji Certify overview: https://deepwiki.com/mosip/inji-certify
- Mimoto local setup: https://docs.mosip.io/inji/inji-wallet/build-and-deployment/local-setup
- Inji Web local setup: https://docs.mosip.io/inji/inji-wallet/inji-web/build-and-deploy/local-setup
- Inji config repo: https://github.com/mosip/inji-config
