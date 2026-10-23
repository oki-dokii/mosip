# walt.id Issuer2 / Verifier2 vs. Inji Compatibility Comparison

**Document**: `deploy/WALTID_COMPARISON.md`\
**Date**: 2026-10-22\
**Owner**: Person 4 (Packaging, CI, and Release Verification)\
**Status**: Completed Documentation-Only Research\
**Boundary**: No driver code created; no cross-vendor pass claimed.

---

## 1. Executive Summary & Context

This study provides an architectural, protocol, and configuration comparison between **walt.id v2 (Issuer2 / Verifier2)** and the **MOSIP Inji stack (Inji Certify, Inji Verify, Mimoto, Inji Web)**.

Per project guidelines:
- This comparison explicitly analyzes the **v2 path** (`Issuer2` and `Verifier2` in the `waltid-identity` toolkit), avoiding the outdated v1 quickstart documentation.
- All versions and source URLs are pinned to verified official releases retrieved on 2026-10-22.
- **Evidence Limit**: This document is purely architectural analysis. **No cross-vendor interoperability pass is claimed**, and no mock/BFF drivers have been altered.

---

## 2. Pinned Component Versions & Sources

| Component / Stack | Version / Tag | Upstream Source URL | Retrieval Date | License |
| :--- | :--- | :--- | :--- | :--- |
| **walt.id Identity (v2 Stack)** | `v1.2.0` (latest stable)<br>Commit: `v1.2.0` | `https://github.com/walt-id/waltid-identity/releases/tag/v1.2.0` | 2026-10-22 | Apache-2.0 |
| **Inji Certify** | `v0.14.0` (latest stable)<br>`v1.0.0-alpha.1` (preview) | `https://github.com/mosip/inji-certify/releases` | 2026-10-22 | MPL-2.0 |
| **Inji Verify** | `v0.18.2` (latest stable)<br>`v1.0.0-alpha.1` (preview) | `https://github.com/mosip/inji-verify/releases` | 2026-10-22 | MPL-2.0 |
| **Inji Web** | `v0.17.0` | `https://github.com/mosip/inji-web/releases` | 2026-10-22 | MPL-2.0 |
| **Mimoto** | `v0.22.0` | `https://github.com/mosip/mimoto/releases` | 2026-10-22 | MPL-2.0 |

---

## 3. Protocol & Architecture Comparison Matrix

| Dimension | walt.id v2 (`Issuer2` / `Verifier2`) | Inji Stack (`Certify` / `Verify`) | Interoperability Assessment |
| :--- | :--- | :--- | :--- |
| **OID4VCI Protocol Version** | **Final 1.0 (Draft 14+ / Final)**<br>Enforces finalized metadata schema (`credential_configurations_supported`), batch issuance, and PAR. | **Draft 13**<br>Uses `credential_definitions` and draft-era token / credential response endpoints. | **High Mismatch**: Metadata field renaming and batch request shapes break automated negotiation without translation shims. |
| **OID4VP Protocol Version** | **Final 1.0**<br>Supports DCQL (Digital Credentials Query Language) and compact signed Request Objects. | **Drafts 21–23**<br>Strictly DIF Presentation Exchange 2.0 (`presentation_definition`). | **High Mismatch**: If Verifier2 requests DCQL, Inji Web / Wallet cannot parse query. Both support DIF PEX 2.0 as fallback. |
| **Credential Formats** | - W3C VC 1.0 / 2.0 (JSON-LD, JWT)<br>- SD-JWT VC (`dc+sd-jwt`, `vc+sd-jwt`)<br>- ISO/IEC 18013-5 mdoc (`mso_mdoc`) | - W3C JSON-LD (LDP-VC with `Ed25519Signature2020`)<br>- SD-JWT VC (`dc+sd-jwt`)<br>- mdoc (*in development*) | **Compatible on Formats**: Both stacks support SD-JWT VC and JSON-LD credentials natively. |
| **Grant Types** | - Authorization Code (optional mandatory PAR, DPoP)<br>- Pre-Authorized Code (tx_code PIN) | - Authorization Code (integrated with eSignet)<br>- Pre-Authorized Code Flow | **Partially Compatible**: Pre-authorized code flow has fewer OIDC server dependencies; authorization code requires IDP federation. |
| **Request Mechanics** | - Signed `request_uri`<br>- Compact Request Object on URL<br>- Response modes: `direct_post`, `direct_post.jwt` | - Direct HTTPS URL with query parameters<br>- Response mode: `direct_post` | **Medium Mismatch**: Inji Verify does not encrypt responses; if Verifier2 enforces `direct_post.jwt`, unencrypted responses fail. |
| **Client Identifier Schemes** | `redirect_uri` (auto-bound), `x509_san_dns`, `x509_hash`, `did`, `verifier_attestation` | Fixed HTTPS URLs (e.g. `https://injiverify.collab.mosip.net`), pre-registered OIDC clients | **Medium Mismatch**: Verifier2 enforces client ID validation against trust registries; Inji Verify uses pre-configured allowlists. |
| **Holder Key Binding** | JWT proof-of-possession, hardware key attestation (`key_attestation`), DPoP | JWT proof (`proof.jwt` in OpenID4VCI draft 13), JSON-LD embedded proof | **Compatible**: Both support standard ES256 / Ed25519 holder key binding proofs in issuance and presentation. |
| **Trust Model** | ETSI trust lists, EUDI X.509 profiles, IETF Token Status List (x5c leaf trust), multi-CA stores | MOSIP Keymanager trust anchors, self-signed test certificates in Collab | **Isolated**: walt.id uses European EUDI trust patterns; Inji relies on MOSIP national ID trust infrastructure. |
| **Response Encryption** | Supported (`direct_post.jwt` via JWE) | Not supported (plain JWS inside `vp_token`) | **Config Dependent**: Verifier2 must be configured for unencrypted `direct_post` to receive Inji presentations. |
| **Runtime & Packaging** | Kotlin / Ktor microservices; single Docker image or JVM fat JAR (ports 7001–7004) | Java / Spring Boot microservices; Spring Cloud Config, PostgreSQL, Keymanager (ports 8080–9090) | **Different Foundations**: walt.id is lightweight self-contained JVM; Inji requires MOSIP platform services. |
| **License** | Apache-2.0 | MPL-2.0 | **Permissive / Weak Copyleft**: No license incompatibility for testing or network integration. |

---

## 4. Feasible Cross-Vendor Journey & Primary Blockers

### Feasible Cross-Vendor Scenario (Described, Not Implemented):
> **Scenario**: walt.id Issuer2 $\rightarrow$ Inji Mobile Wallet $\rightarrow$ Inji Verify (SD-JWT VC)
> 1. **Issuance**: walt.id Issuer2 configured with a pre-authorized code offer for `MockIdentityCredential` formatted as `dc+sd-jwt`.
> 2. **Wallet Intake**: Inji Mobile Wallet scans the offer QR code. If the wallet accepts draft-13/14 compatible token endpoints, it exchanges the pre-authorized code and submits a public key proof.
> 3. **Presentation**: Inji Mobile Wallet presents the SD-JWT credential to Inji Verify via OpenID4VP draft 21 `direct_post`.
> 4. **Verification**: Inji Verify validates the SD-JWT signature against the walt.id Issuer's public JWK key endpoint.

### Primary Blockers to Immediate Cross-Vendor Execution:
1. **OID4VCI Spec Version Mismatch (Draft 13 vs Final 1.0)**:
   - Inji Certify and Inji Web rely on OID4VCI Draft 13 parameter names (e.g., `credential_definitions`, `types`).
   - walt.id Issuer2 implements finalized OpenID4VCI 1.0, expecting `credential_configurations_supported` and batch issuance structures.
2. **OpenID4VP Query Language (DCQL vs DIF PEX)**:
   - walt.id Verifier2 defaults to DCQL queries. Inji Web / Mimoto only implement DIF Presentation Exchange 2.0 (`presentation_definition`).
   - Verifier2 must explicitly disable DCQL and supply a PEX 2.0 descriptor to interact with Inji wallets.
3. **Response Encryption (`direct_post.jwt`)**:
   - Modern walt.id Verifier2 configurations default to encrypted response modes (`direct_post.jwt`).
   - Inji wallets emit unencrypted direct posts with raw JWS tokens, which Verifier2 will reject unless configured with `signed_request=false` and unencrypted response handling.

---

## 5. Summary Finding

| Dimension | Finding |
| :--- | :--- |
| **Cross-Vendor Status** | **NOT CLAIMED** — Purely theoretical architectural evaluation. |
| **Feasibility** | Feasible only via **Pre-Authorized Code SD-JWT** with DIF PEX 2.0 fallback and response encryption disabled. |
| **Driver Work** | **Zero driver changes** made to `apps/bff/` to maintain stability of the core packaging/CI lane. |
