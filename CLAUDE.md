# Working rules for AI sessions on the Inji Interoperability Playground

Read `docs/README.md` first. These rules apply to every code or document change.

## 1. Quiz before changing anything
Before you edit, create or delete any file, ask the user a short quiz (1–4 questions) about the decisions the change depends on. Use the question tool. Skip the quiz only for:
- typo and formatting fixes,
- changes the user has described in full detail in this same message,
- adding an entry to `docs/decisions.md` or `docs/flow.md` that records a change already approved.

Good quiz questions are about things that change what you build: library choice, scope, behaviour on failure, naming of public APIs, data shape. Do not ask about things the docs already settle.

## 2. Log every meaningful decision
In the same change, add an entry to `docs/decisions.md` (template inside) for any library, API, schema, flow, shortcut or rejected-option decision. Include the alternatives, the reason, and the trade-off accepted. Newest first. Never rewrite old entries; supersede them.

## 3. Keep flow.md true
When you add or change an entry point, file, function, call path or step order, update `docs/flow.md` in the same change and add a line to its change log. Names in that file must match the code.

## 4. Keep the requirement chain intact
Reference SRS requirement IDs (FR-xx, NFR-xx) in commits. If a requirement changes, update `docs/SRS.md`, `docs/PRD.md`, and any affected section of `docs/BACKEND.md`, `docs/DATABASE.md`, `docs/UIUX.md`.

## 5. Safety rules for this project
- Never store or log secrets (access tokens, pre-authorized codes, private keys). Redaction happens in `tap/redaction.ts` before storage.
- Test data only. No real personal data.
- Do not copy the external VC playground's layout or visuals.
- Do not modify Inji service source code; integrate through their public APIs.

## 6. Definition of done
Unit tests added, secrets masking checked for new exchange types, `docs/decisions.md` and `docs/flow.md` updated, README or docs updated if setup or behaviour changed.
