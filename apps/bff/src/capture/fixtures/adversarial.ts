import { createHash } from "node:crypto";
import { gzipSync } from "node:zlib";
import { generateKeyPair, SignJWT } from "jose";

// Generated in memory: no complete credential or private key is a committed fixture.
export async function credentialCanaries() {
  const claims = ["CANARY_PERSON_NAME", "CANARY_BIRTH_DATE", "CANARY_STREET_ADDRESS", "CANARY_SUBJECT_ID"];
  const salt = "CANARY_DISCLOSURE_SALT";
  const disclosure = Buffer.from(JSON.stringify([salt, "given_name", claims[0]])).toString("base64url");
  const { privateKey, publicKey } = await generateKeyPair("EdDSA");
  const jwt = await new SignJWT({ iss: "https://issuer.example", vct: "MockVerifiableCredential_SD_JWT",
    _sd_alg: "sha-256", _sd: [createHash("sha256").update(disclosure).digest("base64url")], birthdate: claims[1] })
    .setProtectedHeader({ alg: "EdDSA", typ: "dc+sd-jwt" }).setIssuedAt(1792627200).sign(privateKey);
  const token = `${jwt}~${disclosure}~`;
  const vc = { "@context": ["https://www.w3.org/ns/credentials/v2"], id: claims[3],
    type: ["VerifiableCredential", "FarmerCredential"], issuer: "https://issuer.example",
    validFrom: "2026-10-22T00:00:00Z", credentialSubject: { id: claims[3], name: claims[0], birthdate: claims[1], address: claims[2] },
    proof: { type: "Ed25519Signature2020", proofPurpose: "assertionMethod", proofValue: "CANARY_VC_SIGNATURE" } };
  return { token, jwt, publicKey, vc, forbidden: [...claims, salt, disclosure, jwt, token, vc.proof.proofValue] };
}

export function harEntry(body: unknown, url = "https://issuer.example/credential", status = 200) {
  return { startedDateTime: "2026-10-22T00:00:00.000Z", time: -1,
    request: { method: "POST", url, headers: [{ name: "Cookie", value: "CANARY_COOKIE" }],
      postData: { mimeType: "application/json", text: JSON.stringify(body) } },
    response: { status, headers: [{ name: "Location", value: "https://issuer.example/CANARY_LOCATION#CANARY_FRAGMENT" },
      { name: "Set-Cookie", value: "CANARY_RESPONSE_COOKIE" }], content: { mimeType: "application/json", text: JSON.stringify(body) } } };
}

export function adversarialCorpus() {
  let deep: unknown = { access_token: "CANARY_DEEP" };
  for (let i = 0; i < 200; i++) deep = { child: deep };
  const base64 = harEntry({});
  Object.assign(base64.response.content, { encoding: "base64", text: Buffer.from(JSON.stringify({ access_token: "CANARY_BASE64" })).toString("base64") });
  const gzip = harEntry({});
  gzip.response.headers.push({ name: "Content-Encoding", value: "gzip" });
  Object.assign(gzip.response.content, { encoding: "base64", text: gzipSync(JSON.stringify({ access_token: "CANARY_GZIP" })).toString("base64") });
  const bomb = structuredClone(gzip);
  bomb.response.content.text = gzipSync("CANARY_COMPRESSED".repeat(100_000)).toString("base64");
  return [
    { name: "path-fragment-location-cookie-error", entry: harEntry({ error: "invalid_request", error_description: "CANARY_ERROR" }, "https://verifier.example/vp-results/CANARY_PATH#CANARY_FRAGMENT", 400) },
    { name: "base64-json", entry: base64 },
    { name: "gzip-bytes", entry: gzip },
    { name: "compressed-expansion", entry: bomb },
    { name: "lookalike-unicode", entry: harEntry({ "аccess_token": "CANARY_CYRILLIC", "ｖｐ＿ｔｏｋｅｎ": "CANARY_FULLWIDTH", "access\u200b_token": "CANARY_INVISIBLE" }) },
    { name: "deep-json", entry: harEntry(deep) },
    { name: "wide-json", entry: harEntry(Object.fromEntries(Array.from({ length: 3000 }, (_, i) => [`field${i}`, "CANARY_WIDE"]))) },
  ];
}
