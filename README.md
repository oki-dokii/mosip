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
| 9 | [PHASE0_1.md](PHASE0_1.md) | What Phase 0 decided and what the live Collab contract spikes found |
| 10 | [PHASE2.md](PHASE2.md) | What the application walking skeleton implements and what comes next |

Working rules for people and AI assistants are in `CLAUDE.md`: quiz before changes, log every meaningful decision, keep `flow.md` true.

## Status of this documentation
Phase 0 and Phase 1 are complete as of 2026-10-20. The live Reference Wallet spike issued and verified both JSON-LD and SD-JWT credentials on MOSIP Collab. Phase 2 has a working fixture-backed web and BFF walking skeleton with live run updates, exchange inspection, and write-time secret redaction. Live adapters and Postgres persistence are the next slice.

Run the application locally with:

```bash
pnpm install
pnpm dev
```

Then open `http://localhost:5173`. See [PHASE2.md](PHASE2.md) for the implemented boundary and remaining work.

Run the live synthetic contract probe and its offline fixture checks with:

```bash
pnpm spike:contracts
pnpm test
```

The end-to-end spike needs the official public Certify Postman environment supplied through `OFFICIAL_POSTMAN_ENV_PATH`; see `PHASE0_1.md` for both commands. It generates holder keys in memory and prints only a sanitized result. Inji Web's boundary is also confirmed: guest mode completes issuance/download, JSON-LD presentation requires a logged-in persistent wallet, and SD-JWT presentation is pending upstream.

## Sources used for the Inji API facts
- Inji Verify OpenID4VP endpoints and draft: https://deepwiki.com/mosip/inji-verify/5-openid4vp-implementation
- Inji Verify cross-device flow: https://deepwiki.com/mosip/inji-verify/5.1-cross-device-flow
- Inji Verify SDK: https://npmjs.com/package/@mosip/react-inji-verify-sdk
- Inji Certify overview: https://deepwiki.com/mosip/inji-certify
- Mimoto local setup: https://docs.mosip.io/inji/inji-wallet/build-and-deployment/local-setup
- Inji Web local setup: https://docs.mosip.io/inji/inji-wallet/inji-web/build-and-deploy/local-setup
- Inji config repo: https://github.com/mosip/inji-config
