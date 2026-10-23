# Pinned Local Inji Profile & Integration Provenance

**Document**: `deploy/INJI_LOCAL.md`  
**Date**: 2026-10-22  
**Owner**: Person 4 (Packaging, CI, and Release Verification)  
**Status**: Stage 1 & Stage 2 Documented / Blocked on Upstream MOSIP Infrastructure  

---

## 1. Overview & Purpose

This document provides the authoritative provenance, configuration architecture, and blocker analysis for running pinned local Inji services (**Inji Certify**, **Inji Verify**, **Mimoto**, and **Inji Web**).

Per the four-person execution plan:
- **Stage 1**: Stand up pinned Inji Certify and Inji Verify for local synthetic issuance and verification.
- **Stage 2**: Stand up pinned Mimoto and Inji Web to support the assisted Web wallet flow (**A1**).
- **Handoff to Person 2**: Provide concrete endpoint coordinates, ports, and prerequisites for Inji Web consumption.
- **Handoff to Person 1**: Provide canonical origins, TLS/DNS parameters, redirect URIs, and upstream targets for the protocol capture proxy.

---

## 2. Upstream Component Provenance Table

All versions, image repositories, and documentation references below are sourced directly from official MOSIP/Inji release manifests (retrieved 2026-10-22). No version labels or configurations are invented.

| Component | Upstream Repository | Pinned Version / Tag | Configuration Source URL | Host Port | Health Check | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Inji Certify** | `https://github.com/mosip/inji-certify` | `v0.14.0` (latest stable)<br>`v1.0.0-alpha.1` (preview) | `https://docs.inji.io/inji-certify/` | `8080` | `GET /actuator/health` | **BLOCKED**: Requires MOSIP Keymanager and eSignet IDP to sign VCs |
| **Inji Verify** | `https://github.com/mosip/inji-verify` | `v0.18.2` (latest stable)<br>`v1.0.0-alpha.1` (preview) | `https://docs.inji.io/inji-verify/` | `8081` | `GET /actuator/health` | **BLOCKED**: Requires registered verifier configuration and trust anchors |
| **Mimoto** | `https://github.com/mosip/mimoto` | `v0.22.0` (latest stable)<br>`v1.0.0-alpha.1` (preview) | `https://docs.inji.io/inji-wallet/inji-web/` | `9090` | `GET /actuator/health` | **BLOCKED**: Requires eSignet OIDC client registration and client keystore |
| **Inji Web** | `https://github.com/mosip/inji-web` | `v0.17.0` (latest stable) | `https://docs.inji.io/inji-wallet/inji-web/` | `3000` | `GET /` | **BLOCKED**: Dependent on Mimoto and authenticated eSignet user |

---

## 3. Opt-in Compose Profile (`deploy/docker-compose.inji.yml`)

To prevent contaminating the core playground and mock workflows (`core` and `mocks`), local Inji services are specified in an opt-in compose override file: `deploy/docker-compose.inji.yml`.

### Architecture:
```
+-----------------------------------------------------------------+
|                    Opt-in Inji Local Stack                      |
|                                                                 |
|  [ Inji Web (Port 3000) ] ---> [ Mimoto (Port 9090) ]           |
|                                      |                          |
|                                      v                          |
|  [ Inji Certify (Port 8080) ]  [ Inji Verify (Port 8081) ]      |
|                                                                 |
|  Dependencies:                                                  |
|  - PostgreSQL (Inji DB schema)                                  |
|  - eSignet Mock (OIDC Auth Server, Port 8088)                   |
|  - MOSIP Keymanager / Soft-HSM Keystore                         |
+-----------------------------------------------------------------+
```

### Start & Stop Procedure:
```bash
# To run core + mocks + opt-in inji stack:
docker compose -f docker-compose.yml -f deploy/docker-compose.inji.yml --profile inji up -d

# Check health:
docker compose -f docker-compose.yml -f deploy/docker-compose.inji.yml --profile inji ps

# Teardown:
docker compose -f docker-compose.yml -f deploy/docker-compose.inji.yml --profile inji down -v
```

---

## 4. Stage 1 Evaluation: Certify + Verify

### Requirement:
Stand up pinned Inji Certify and Inji Verify locally, execute a Certify -> Reference Wallet -> Verify synthetic flow using environment variables only, and record run IDs.

### Evaluation & Blocker Findings:
1. **Certify Architecture**:
   - Official Inji Certify is a Java/Spring Boot microservice implementing OpenID4VCI (draft 13).
   - Inji Certify delegates signature generation, certificate handling, and key custody to the **MOSIP Keymanager** service. It does not contain an embedded software key generator for standalone operation.
   - Issuance authentication requires an upstream OAuth 2.0 / OIDC provider (**eSignet**) to authenticate the holder identity (`individual_id`) before issuing credentials.
2. **Playground Driver Inspection (`apps/bff/src/drivers/collab.ts`)**:
   - Inspection of `apps/bff/src/drivers/collab.ts` (lines 122-132) confirms that running Inji Certify requires `OFFICIAL_POSTMAN_ENV_PATH` and `MOCK_OTP`:
     ```typescript
     const postmanEnvironmentPath = process.env.OFFICIAL_POSTMAN_ENV_PATH;
     const mockOtp = process.env.MOCK_OTP;
     if (!postmanEnvironmentPath || !mockOtp) {
       throw new Error("Collab mode requires OFFICIAL_POSTMAN_ENV_PATH and MOCK_OTP");
     }
     ```
   - The environment file must contain a pre-registered `clientId`, `privateKey_jwk` (with private key parameter `d`), and `individual_id`.
3. **Local Status**:
   - **BLOCKED**: Running Inji Certify locally in isolation without the entire MOSIP foundational cluster (Keymanager, Config Server, DB migrations, and eSignet) is impossible without pre-configured cryptographic keystores and database seeds.
   - In hosted Collab mode, the playground successfully uses the hosted Collab endpoints (`https://injicertify-mock.collab.mosip.net` and `https://injiverify.collab.mosip.net/v1/verify`).
   - Mock issuer and mock verifier provide the isolated, reproducible synthetic test path for development and CI.

---

## 5. Stage 2 Evaluation: Mimoto + Inji Web (for A1)

### Requirement:
Provide Person 2 with a usable local Mimoto + Inji Web endpoint for A1 (Inji Web login -> issue -> hold -> present).

### What the Official Setup Requires:
1. **OIDC Client Keystore**:
   - Mimoto acts as an OIDC client to eSignet.
   - It requires a PKCS12 (`.p12`) or JWK keystore containing the client's private signing key and public certificate chain.
   - This client must be registered in eSignet's client repository with authorized redirect URIs: `http://localhost:3000/callback` and `http://localhost:9090/login/oauth2/code/esignet`.
2. **Persistent Test Identity**:
   - Inji Web requires a real or simulated user identity in eSignet (e.g. UIN/VID with OTP authentication).
   - As recorded in the team's plan, a dedicated persistent Collab Inji Web test account is currently unavailable.
3. **Local Inji Web UI**:
   - Built on React/Vite, packaged in Nginx serving static assets and proxying `/mimoto` requests.

### Endpoint Handoff to Person 2:
When local or tunnelled endpoints are started, Person 2 consumes the following without altering Compose:

| Service | Target URL | Local Port | Hosts File Entry | Prerequisites |
| :--- | :--- | :--- | :--- | :--- |
| **Inji Web UI** | `http://localhost:3000` | `3000` | Not required (or `injiweb.local`) | Modern browser; test user credentials |
| **Mimoto BFF** | `http://localhost:9090` | `9090` | Not required | Valid OIDC client keystore; eSignet reachability |
| **Certify Target** | `http://localhost:8080` | `8080` | Not required | `CERTIFY_BASE_URL` env var |
| **Verify Target** | `http://localhost:8081` | `8081` | Not required | `VERIFY_BASE_URL` env var |

### Blocker Statement for Stage 2:
> **STATUS**: **BLOCKED** (Missing OIDC Client Keystore & Test Account)  
> Stage 2 cannot be completed locally without:
> 1. An OIDC client ID and corresponding private signing keystore registered in an active eSignet instance.
> 2. A persistent test identity (individual ID / credentials) capable of completing the eSignet authentication challenge.  
> Containers alone do not remove this blocker. Person 2's assisted journey remains in fixture mode until a registered account/keystore is provisioned.

---

## 6. Handoff to Person 1: Canonical Origins & Capture Proxy Prerequisites

Person 1 requires fixed upstream targets, pinned canonical origins, and metadata parameters before building the transparent protocol capture proxy.

| Service | Canonical Origin (Scheme/Host/Port) | Local TLS / DNS Strategy | Immutable Metadata / Issuer Identifier | Redirect URIs | Fixed Upstream Target | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Inji Certify** | `http://127.0.0.1:8080`<br>(Collab: `https://injicertify-mock.collab.mosip.net`) | HTTP localhost for local; HTTPS SNI for Collab | `https://injicertify-mock.collab.mosip.net` (must match `iss` claim in VCs) | N/A (Server-to-server) | `http://127.0.0.1:8080`<br>`injicertify-mock.collab.mosip.net:443` | **Settled** |
| **Inji Verify** | `http://127.0.0.1:8081`<br>(Collab: `https://injiverify.collab.mosip.net`) | HTTP localhost for local; HTTPS SNI for Collab | Verifier Client ID: `https://injiverify.collab.mosip.net` | Direct post callback URL | `http://127.0.0.1:8081`<br>`injiverify.collab.mosip.net:443` | **Settled** |
| **Mimoto** | `http://127.0.0.1:9090` | HTTP localhost | Mimoto session identifier | `http://localhost:9090/login/oauth2/code/esignet` | `http://127.0.0.1:9090` | **Settled** |
| **Inji Web** | `http://127.0.0.1:3000` | HTTP localhost | Web App Origin: `http://localhost:3000` | `http://localhost:3000/callback` | `http://127.0.0.1:3000` | **Settled** |
| **eSignet (IDP)** | `https://esignet-mock.collab.mosip.net` | HTTPS SNI | `https://esignet-mock.collab.mosip.net/v1/esignet` | `http://localhost:3000/callback` | `esignet-mock.collab.mosip.net:443` | **Settled** |

### Important Constraints for Person 1:
1. **No URL Rewriting**: The proxy must not rewrite host headers, path prefixes, or authorization redirect URIs. Any alteration of `client_id`, `redirect_uri`, or `issuer` invalidates client authentication and JWT signatures.
2. **Preserve Query Parameters**: Parameters such as `response_type`, `client_id`, `scope`, `code_challenge`, and `state` must pass through untransformed.
3. **Transparent Forwarding**: The transparent proxy should observe traffic passively or use standard HTTP proxying (`HTTP_PROXY`), avoiding `/tap/...` path rewrites.
