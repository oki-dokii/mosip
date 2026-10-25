# Deployment assets

| Asset | Purpose | Evidence boundary |
| --- | --- | --- |
| [Local Inji runbook](INJI_LOCAL.md) | One-command official Certify → reference holder → official Verify control | Local services, one synthetic SD-JWT; no local Inji wallet |
| [Verify Compose](docker-compose.verify-local.yml) and [database seed](verify-db-init.sql) | Pinned Verify 0.18.2 service and isolated PostgreSQL | Used by `pnpm demo:inji` |
| [Mobile runbook](MOBILE_INJI.md) and [mobile Compose](docker-compose.mobile.yml) | Official Certify for real Android wallet validation | Uses temporary HTTPS issuer route and Collab Verify; separate hybrid A2 evidence |
| [Project deployment guide](../docs/DEPLOYMENT.md) | Playground web/BFF/PostgreSQL/mocks | `pnpm demo:docker` is synthetic, distinct from the Inji service control |
| [walt.id comparison](WALTID_COMPARISON.md) | Cross-vendor research | Documentation only |
| [Nginx config](nginx.conf) | Playground web reverse proxy | Core container build |

The older [full-stack Compose sketch](docker-compose.inji.yml) has not been validated. It is retained for provenance only; its service entries should not be treated as a working Inji Web/Mimoto deployment.

The separate [local Inji Web wallet shell](INJI_WEB_LOCAL.md) now runs pinned official Web and Mimoto images with an isolated database and synthetic local sign-in. It proves wallet creation and fresh-session unlock, and the connected JSON-LD profile now passes issuance, exact-card reload and presentation. See `pnpm demo:web-jsonld` and its explicit adapter boundaries.

The [endpoint catalogue](ENDPOINTS.md) and [machine-readable map](endpoints.json) describe the separate alpha and connected JSON-LD profiles. `pnpm start:local-full` reuses the proven projects; `pnpm smoke:local-full` checks readiness only.
