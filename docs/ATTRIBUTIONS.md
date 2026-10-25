# Third-party software and design attribution

The playground is original project code. It integrates with Inji services through public APIs and does not vendor Inji source. Its interface is not copied from an external VC playground. The repository's [MPL-2.0 license](../LICENSE) covers the project's own source; each dependency remains under its own license.

The table records **direct runtime dependencies** and license identifiers from their installed `package.json` metadata. Exact versions are pinned in the workspace manifests and lockfile. This is a reviewer index, not legal advice.

| Library | Role | Installed license metadata |
|---|---|---|
| React and React DOM | Web interface | MIT |
| Vite | Web build/development | MIT |
| Lucide React | Interface icons | ISC |
| Express | BFF HTTP API | MIT |
| Socket.IO and Socket.IO Client | Live run progress | MIT |
| Prisma Client | PostgreSQL access | Apache-2.0 |
| jose | JWT and JWK operations | MIT |
| qrcode 1.5.4 | Local encoding of mobile issuance/presentation QR codes | MIT |
| jsonc-parser 3.3.1 | Bounded duplicate-aware mock protocol JSON parsing | MIT |
| jsonld and jsonld-signatures | JSON-LD processing and proofs | BSD-3-Clause |
| Zod | Shared runtime schemas | MIT |
| Digital Bazaar Ed25519 Signature 2020 and Verification Key 2020 | JSON-LD proof support | BSD-3-Clause |

The project also uses development-only tooling (TypeScript, Vitest, Tailwind, PostCSS, tsx, and Prisma CLI). On 2026-10-23, a local installed-package inventory found **382 unique package/version pairs** under pnpm's virtual store on macOS arm64: 322 MIT, 17 ISC, 19 Apache-2.0, 16 BSD-3-Clause, 3 BSD-2-Clause, and one each of MIT-0, CC-BY-4.0, MPL-2.0, and `(MIT OR CC0-1.0)`. One package, `xmlhttprequest-ssl@2.1.2`, omits `license` metadata but includes an MIT-style `LICENSE` file, which was inspected. The local `pnpm licenses list --json` command still fails because its store lacks a package index file. This manual inventory is platform-specific and does not certify every transitive notice or container-base-image license; include required license texts and notices if redistributing binaries/images.

The web app contains no vendored image or font files. Its icons come from Lucide React. The four committed Person 2 PNGs are synthetic screenshots captured from this app by the browser tests; no third-party UI image is bundled. The repository secret audit does not inspect binary image contents, so review any new image before publication.

Comparable interoperability projects informed the scenario and adapter approach; see [the research table](NEXT_STEPS_4_PERSON_PLAN.md#research-worth-using). No code, test keys, or UI layout was copied from those repositories.
