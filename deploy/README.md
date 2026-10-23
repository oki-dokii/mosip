# Deployment & Infrastructure Directory (`deploy/`)

This directory contains deployment assets, local Inji profile definitions, reverse proxy configurations, and cross-vendor research for the Inji Interoperability Playground.

---

## Quick Navigation

| Document / Asset | Purpose | Primary Audience |
| :--- | :--- | :--- |
| **[`../PERSON4_HANDOFF.md`](../PERSON4_HANDOFF.md)** | **Central Handoff Document** covering all Person 4 deliverables, integration instructions, patch series, and role-specific handoffs. | **Integrator, Persons 1–3** |
| **[`../DEPLOYMENT.md`](../DEPLOYMENT.md)** | **Operational Runbook** covering local Docker Compose quick start, profiles, environment variables, troubleshooting, and clean-machine verification. | **Reviewers, Operators** |
| **[`INJI_LOCAL.md`](./INJI_LOCAL.md)** | **Pinned Local Inji Provenance & Integration Specs**: Provenance table for Certify, Verify, Mimoto, and Inji Web; Stage 1 & 2 evaluations; Person 2 endpoints; Person 1 canonical origins. | **Person 1, Person 2** |
| **[`docker-compose.inji.yml`](./docker-compose.inji.yml)** | **Opt-In Inji Compose Override** for spinning up official Inji services (`profiles: [inji]`) without polluting the core playground or mock stack. | **DevOps, Testers** |
| **[`WALTID_COMPARISON.md`](./WALTID_COMPARISON.md)** | **walt.id v2 Compatibility Study**: Architectural comparison between `waltid-identity` v1.2.0 (Issuer2/Verifier2) and Inji components. | **Integrator, Protocol Researchers** |
| **[`nginx.conf`](./nginx.conf)** | Nginx reverse proxy configuration for the Web frontend container. | **Internal Compose** |

---

## Role-Specific Quick Links

- **Integrator**: See [Section 5 & 6 of `PERSON4_HANDOFF.md`](../PERSON4_HANDOFF.md#5-requests-for-the-integrator) for patch series instructions (`../person4-patches`) and ready-to-paste README/badge snippets.
- **Person 1 (Protocol Capture)**: See [Section 6 of `INJI_LOCAL.md`](./INJI_LOCAL.md#6-handoff-to-person-1-canonical-origins--capture-proxy-prerequisites) for canonical origins, TLS/SNI rules, and redirect URIs.
- **Person 2 (Inji Web UI)**: See [Section 5 of `INJI_LOCAL.md`](./INJI_LOCAL.md#5-stage-2-evaluation-mimoto--inji-web-for-a1) for Inji Web (`:3000`) and Mimoto (`:9090`) local endpoint details.
- **Person 3 (Protocol Correctness)**: The mock verifier (`:4102`) and mock issuer (`:4101`) are isolated in `docker-compose.yml` under `--profile mocks`.
