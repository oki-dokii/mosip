import { createPrivateKey, createPublicKey, generateKeyPairSync, X509Certificate, type KeyObject } from "node:crypto";
import { readFileSync } from "node:fs";
import { isIP } from "node:net";
import { exportJWK, type JWTHeaderParameters } from "jose";

export interface IssuerSigner {
  privateKey: KeyObject;
  issuer: string;
  algorithm: "EdDSA" | "ES256" | "RS256";
  header: JWTHeaderParameters;
}

export async function loadIssuerSigner(options: {
  privateKeyPath?: string | undefined;
  certificatePath?: string | undefined;
  issuerUrl: string;
}): Promise<IssuerSigner> {
  if (Boolean(options.privateKeyPath) !== Boolean(options.certificatePath)) {
    throw new Error("The X.509 mock issuer needs both a private key and a certificate chain");
  }
  if (!options.privateKeyPath || !options.certificatePath) {
    const { publicKey, privateKey } = generateKeyPairSync("ed25519");
    const publicJwk = await exportJWK(publicKey);
    const issuer = `did:jwk:${Buffer.from(JSON.stringify(publicJwk)).toString("base64url")}`;
    return { privateKey, issuer, algorithm: "EdDSA", header: { alg: "EdDSA", typ: "vc+sd-jwt", kid: `${issuer}#0` } };
  }

  const privateKey = createPrivateKey(readFileSync(options.privateKeyPath));
  const certificatePem = readFileSync(options.certificatePath, "utf8");
  const certificates = certificatePem.match(/-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/g);
  if (!certificates?.length) throw new Error("The X.509 mock issuer certificate chain is empty");
  const leaf = new X509Certificate(certificates[0]);
  const privatePublicKey = createPublicKey(privateKey).export({ format: "der", type: "spki" });
  const certificatePublicKey = leaf.publicKey.export({ format: "der", type: "spki" });
  if (!Buffer.from(privatePublicKey).equals(Buffer.from(certificatePublicKey))) {
    throw new Error("The X.509 mock issuer certificate does not match its private key");
  }
  if (Date.parse(leaf.validFrom) > Date.now() || Date.parse(leaf.validTo) < Date.now()) {
    throw new Error("The X.509 mock issuer certificate is not currently valid");
  }
  const issuerUrl = new URL(options.issuerUrl);
  const hostnameMatches = isIP(issuerUrl.hostname) ? leaf.checkIP(issuerUrl.hostname) : leaf.checkHost(issuerUrl.hostname);
  if (issuerUrl.protocol !== "https:" || !hostnameMatches) {
    throw new Error("The X.509 mock issuer needs an HTTPS issuer ID matching the certificate hostname");
  }
  const algorithm = privateKey.asymmetricKeyType === "ed25519" ? "EdDSA"
    : privateKey.asymmetricKeyType === "rsa" ? "RS256"
      : privateKey.asymmetricKeyType === "ec" && privateKey.asymmetricKeyDetails?.namedCurve === "prime256v1" ? "ES256" : null;
  if (!algorithm) throw new Error("The X.509 mock issuer needs an Ed25519, RSA, or P-256 key");
  const x5c = certificates.map((certificate) => new X509Certificate(certificate).raw.toString("base64"));
  return { privateKey, issuer: options.issuerUrl, algorithm, header: { alg: algorithm, typ: "vc+sd-jwt", x5c } };
}
