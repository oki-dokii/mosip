# Third-party software and design attribution

The playground is original project code. It integrates with Inji services through public APIs and does not vendor Inji source. Its interface is not copied from an external VC playground. The repository's [MPL-2.0 license](LICENSE) covers the project's own source; each dependency remains under its own license.

The table records **direct runtime dependencies** and license identifiers from their installed `package.json` metadata at the 2026-10-21 checkpoint. Exact versions are pinned in the workspace manifests and lockfile. This is a useful reviewer index, not a complete transitive dependency notice or legal audit.

| Library | Role | Installed license metadata |
|---|---|---|
| React and React DOM | Web interface | MIT |
| Vite | Web build/development | MIT |
| Lucide React | Interface icons | ISC |
| Express | BFF HTTP API | MIT |
| Socket.IO and Socket.IO Client | Live run progress | MIT |
| Prisma Client | PostgreSQL access | Apache-2.0 |
| jose | JWT and JWK operations | MIT |
| jsonc-parser 3.3.1 | Bounded duplicate-aware mock protocol JSON parsing | MIT |
| jsonld and jsonld-signatures | JSON-LD processing and proofs | BSD-3-Clause |
| Zod | Shared runtime schemas | MIT |
| Digital Bazaar Ed25519 Signature 2020 and Verification Key 2020 | JSON-LD proof support | BSD-3-Clause |

The project also uses development-only tooling (TypeScript, Vitest, Tailwind, PostCSS, tsx, and Prisma CLI). Before publishing a packaged distribution, run a full license/notice inventory from a fresh dependency install, include any required third-party notices, and review all assets and fonts. The local `pnpm licenses list --json` command could not complete at this checkpoint because the existing pnpm store lacked a package index file; no complete transitive audit is claimed.

Comparable interoperability projects informed the scenario and adapter approach; see [the research table](NEXT_STEPS_4_PERSON_PLAN.md#research-worth-using). No code, test keys, or UI layout was copied from those repositories.
