# Scenarios and evidence levels

The playground now offers named, versioned-in-code scenarios through `GET /api/v1/scenarios`. Choosing one in the web UI fills the issuer, wallet, verifier, format, and fault. The run keeps its stable `scenarioId`; editing any field turns it into a custom run. The BFF rejects an unknown scenario ID or a preset whose configuration has been changed. A replay is a new custom run because its fault may differ from the original preset. In live Collab mode, the catalog disables Certify cases until `OFFICIAL_POSTMAN_ENV_PATH` and `MOCK_OTP` are configured, and the external mock-issuer case until `MOCK_ISSUER_BASE_URL` is configured.

The first catalog deliberately changes one variable at a time:

| Scenario | Changed variable | Expected result |
|---|---|---|
| Certify → Reference Wallet → Verify · SD-JWT | Baseline | Valid |
| Certify → Reference Wallet → Verify · JSON-LD | Format | Valid |
| Mock issuer → Reference Wallet → Inji Verify | Issuer | Valid |
| Certify → Reference Wallet → Verify · bad signature | Presentation fault | Invalid |

This follows the configuration-driven scenario approach in the [EWC interoperability backend](https://github.com/EWC-consortium/ewc-wallet-conformance-backend), adapted to the combinations this repository actually supports. It also follows the [SIROS test-suite separation](https://github.com/sirosfoundation/sirosid-tests) between quick simulations, mock integration, and protocol-level runs. No source code or test keys were copied from those repositories.

Every run report and matrix export now states an evidence tier. The matrix keeps a separate latest result per tier, so a newer fixture pass cannot replace a live Reference Wallet result for the same combination.

| Tier | What a pass shows | What it cannot prove |
|---|---|---|
| `fixture` | The playground's simulated orchestration and UI path work. | Any live issuer, wallet, or verifier behavior. |
| `mock_interop` | A live Reference Wallet flow used at least one external mock role. | An all-Inji implementation or production trust. |
| `reference_wallet` | Inji issuer and verifier services completed a flow through the automated Reference Wallet. | Inji Web/mobile wallet storage or presentation. |
| `unverified` | The stored run lacks enough provenance to assign the above tiers, or names an Inji wallet without wallet evidence. | A real-wallet interoperability pass. |

Tier classification uses the run's saved component versions and selected roles. HAR import adds sanitized protocol observations but does not promote a run's tier or outcome. A future real Inji wallet pass needs an explicit evidence gate: a pinned wallet build, observed storage and presentation, and the verifier result. The absence of a dedicated Inji Web test account still blocks that live check.
