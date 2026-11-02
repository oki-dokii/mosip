import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { importX509, jwtVerify, SignJWT } from "jose";
import { describe, expect, it } from "vitest";
import { loadIssuerSigner } from "./signing.js";

describe("mock issuer X.509 signing", () => {
  it("embeds a matching certificate and signs a verifiable JWT", async () => {
    const directory = mkdtempSync(join(tmpdir(), "playground-issuer-cert-"));
    try {
      const keyPath = join(directory, "key.pem");
      const certificatePath = join(directory, "cert.pem");
      const openssl = process.platform === "win32" && existsSync("C:\\Program Files\\Git\\usr\\bin\\openssl.exe") ? "C:\\Program Files\\Git\\usr\\bin\\openssl.exe" : "openssl";
      const env = { ...process.env, OPENSSL_CONF: existsSync("C:\\Program Files\\Git\\usr\\ssl\\openssl.cnf") ? "C:\\Program Files\\Git\\usr\\ssl\\openssl.cnf" : "" };
      execFileSync(openssl, ["req", "-x509", "-newkey", "ed25519", "-nodes", "-keyout", keyPath, "-out", certificatePath, "-days", "1", "-subj", "/CN=issuer.test", "-addext", "subjectAltName=DNS:issuer.test"], { stdio: "ignore", env });
      const signer = await loadIssuerSigner({ privateKeyPath: keyPath, certificatePath, issuerUrl: "https://issuer.test" });
      expect(signer.issuer).toBe("https://issuer.test");
      expect(signer.header.x5c).toHaveLength(1);
      const jwt = await new SignJWT({ iss: signer.issuer }).setProtectedHeader(signer.header).sign(signer.privateKey);
      const certificate = readFileSync(certificatePath, "utf8");
      await expect(jwtVerify(jwt, await importX509(certificate, "EdDSA"))).resolves.toBeDefined();
      await expect(loadIssuerSigner({ privateKeyPath: keyPath, certificatePath, issuerUrl: "https://other.test" })).rejects.toThrow("matching the certificate hostname");
      const otherKeyPath = join(directory, "other-key.pem");
      const otherCertificatePath = join(directory, "other-cert.pem");
      execFileSync(openssl, ["req", "-x509", "-newkey", "ed25519", "-nodes", "-keyout", otherKeyPath, "-out", otherCertificatePath, "-days", "1", "-subj", "/CN=localhost"], { stdio: "ignore", env });
      await expect(loadIssuerSigner({ privateKeyPath: otherKeyPath, certificatePath, issuerUrl: "https://issuer.test" })).rejects.toThrow("does not match");
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
