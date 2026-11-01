# Add an issuer in five minutes
1. Open `apps/web/public/parties.json`. Copy an issuer row and give it a unique lowercase ID, a display name and role `issuer`.
2. Set its public HTTPS endpoint (HTTP is allowed on localhost or 127.0.0.1). Never enter credentials, query parameters, fragments or invitation URLs. List the exact formats and flows the deployment claims. Use an empty formats list if unknown.
3. Set `evidenceTier` to `registered only` and `evidence` to null. Only attach a sanitized, repository-relative run record after executing that implementation.
4. Open /parties in the running web app and filter by issuer. The /capabilities page uses the same registry. When serving a production build, replace its public parties.json or rebuild the web image. The browser fetches this file at page load.
5. Registry enrollment requires no code. The server does not make outbound calls to a URL supplied in the directory. Running a new protocol requires a compatible driver and an explicit trust policy.

Reproduce the QR table with `node scripts/qr-capacity.mjs` after installing the locked dependencies. Numbers apply to the synthetic samples and ECC M only; no user credential is read or written.

For a container deployment, you can mount the reviewed registry at `/usr/share/nginx/html/parties.json:ro` in the web service instead of rebuilding the bundle. This directory accepts only public URLs and evidence references; it never asks the browser to contact an issuer or wallet. The linked report, rather than the party label, determines which combination was demonstrated.
