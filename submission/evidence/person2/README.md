# Person 2 browser evidence — 23 October 2026

All artifacts here are synthetic or independent-mock evidence. **No live Inji Web account, wallet storage or A1 pass is represented.**

1. `assisted-fixture.png`: presentation checkpoint after an explicitly simulated storage confirmation. The top label identifies fixture evidence and the A1 blocker. The request action opens a local synthetic summary. The countdown and cancellation controls remain available; neither endpoint traffic nor clicking a link establishes completion.
2. `capture-coverage.png`: the server's coverage for a synthetic four-service import. Blue rows are observed HTTP traffic; neutral rows are missing or not observable. `STORE` remains not observable. Projection totals explain withheld names; missing traffic is explicitly not styled as credential rejection.
3. `public-evidence.png`: safe projected JSON-LD types remain visible alongside `not_verified`. Unknown names (`portrait`, `farmer_id`) and their synthetic values are withheld. This screenshot shows metadata, not validated credential contents.
4. `accessibility.json` and `capture-accessibility.json`: axe WCAG 2 A/AA and 2.1 AA checks, including contrast, for the assisted panel and added capture/public-evidence sections respectively. Scope is explicit; these are not a claim of a full application accessibility audit.

The Chromium smoke also completes an SD-JWT positive control with independent local mock issuer/verifier services and Reference Wallet, checks API/DOM for synthetic canary absence, and exercises keyboard fixture actions. The imported fixture includes a synthetic JSON-LD credential variant solely to exercise public projection; it does not describe the mock run's issued credential or prove wallet interoperability.

Reproduce with `pnpm --filter @playground/web test:browser` after installing Chromium. The command refreshes the screenshots and scoped axe reports. Main test artifacts stay in `/tmp/person2-playwright-results`, outside the repository. Screenshot layout was inspected; a countdown reset issue found during inspection was fixed and regression-tested.
