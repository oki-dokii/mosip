// Decode only in memory, then project an explicit vocabulary. Never return raw signed objects.
const NAMES = new Set([
  "VerifiableCredential", "VerifiablePresentation", "FarmerCredential", "MockVerifiableCredential",
  "FarmerCredential_VCDM2.0", "MockVerifiableCredential_SD_JWT", "MockVerifiableCredential_LDP_VC",
  "given_name", "family_name", "name", "birthdate", "age_over_18", "email", "address",
  "credentialSubject", "type", "issuer", "iss", "aud", "iat", "exp", "nbf", "vct", "cnf",
  "_sd", "_sd_alg", "sub", "nonce", "jti", "credential", "id", "nationality",
]);
const FORMATS = new Set(["vc+sd-jwt", "dc+sd-jwt", "ldp_vc", "jwt_vc_json", "mso_mdoc"]);
const ALGORITHMS = new Set(["EdDSA", "ES256", "ES384", "RS256", "PS256", "none"]);
const TYPES = new Set(["JWT", "oauth-authz-req+jwt", "openid4vci-proof+jwt", "kb+jwt", "vc+sd-jwt", "dc+sd-jwt"]);
const PROOFS = new Set(["Ed25519Signature2020", "Ed25519Signature2018", "DataIntegrityProof", "JsonWebSignature2020"]);
const OUTCOMES = new Set(["valid", "invalid", "expired", "error", "pending", "VP_SUBMITTED", "SUCCESS", "FAILED"]);
const ERRORS = new Set(["invalid_request", "invalid_token", "invalid_grant", "access_denied", "invalid_proof", "unsupported_credential_format"]);
const allowed = (set: ReadonlySet<string>, value: unknown): value is string => typeof value === "string" && set.has(value);
type Obj = Record<string, unknown>;
export interface PublicProtocolItem { kind: string; summary: Record<string, unknown> }
export interface PublicProtocolView { schemaVersion: 1; authenticity: "not_verified"; items: PublicProtocolItem[] }
const object = (v: unknown): Obj | null => v !== null && typeof v === "object" && !Array.isArray(v) ? v as Obj : null;
const array = (v: unknown): unknown[] => Array.isArray(v) ? v.slice(0, 32) : [];
const names = (v: unknown): string[] => array(v).filter((s): s is string => typeof s === "string" && NAMES.has(s));
const format = (v: unknown) => typeof v === "string" && FORMATS.has(v) ? v : undefined;

function boundedJson(text: string): unknown {
  if (Buffer.byteLength(text) > 131_072) return null;
  try { return JSON.parse(text); } catch { return null; }
}
function jwtPart(token: string, index: number): Obj | null {
  if (token.length > 131_072) return null;
  const parts = token.split(".");
  if (parts.length !== 3 || !parts.every((part) => /^[A-Za-z0-9_-]*$/.test(part))) return null;
  return object(boundedJson(Buffer.from(parts[index] ?? "", "base64url").toString("utf8")));
}
function header(token: string) {
  const h = jwtPart(token, 0);
  return h ? { ...(allowed(ALGORITHMS, h.alg) ? { alg: h.alg } : {}), ...(allowed(TYPES, h.typ) ? { typ: h.typ } : {}), keyIdPresent: typeof h.kid === "string", embeddedKeyPresent: !!h.jwk, certificateChainPresent: Array.isArray(h.x5c) } : null;
}
function endpoint(value: unknown, origins: ReadonlyMap<string, unknown>) {
  if (typeof value !== "string") return null;
  const did = /^did:(web|jwk|key):/.exec(value);
  if (did) return { didMethod: did[1] };
  try { const url = new URL(value); return origins.has(url.origin) && !url.username && !url.password ? { origin: url.origin, path: "[REDACTED]" } : { withheld: true }; }
  catch { return { withheld: true }; }
}
function constraints(value: unknown) {
  const paths = array(value).filter((path): path is string => typeof path === "string" && /^\$\.(?:credentialSubject\.)?(?:type|given_name|family_name|birthdate|age_over_18|nationality)$/.test(path));
  return paths;
}
function presentationDefinition(v: Obj) {
  return { descriptors: array(v.input_descriptors).map((raw) => {
    const d = object(raw) ?? {};
    const c = object(d.constraints) ?? {};
    return { formats: Object.keys(object(d.format) ?? {}).filter((f) => FORMATS.has(f)), fields: array(c.fields).map((rawField) => {
      const field = object(rawField) ?? {};
      const filter = object(field.filter) ?? {};
      return { paths: constraints(field.path), ...(typeof filter.type === "string" && ["string", "number", "boolean", "array"].includes(filter.type) ? { type: filter.type } : {}), allowedTypes: names(filter.enum), ...(allowed(NAMES, filter.const) ? { const: filter.const } : {}) };
    }) };
  }) };
}
function dcql(v: Obj) {
  return { credentials: array(v.credentials).map((raw) => {
    const c = object(raw) ?? {};
    return { ...(format(c.format) ? { format: c.format } : {}), claims: array(c.claims).map((rawClaim) => {
      const claim = object(rawClaim) ?? {};
      return { path: array(claim.path).map((segment) => typeof segment === "string" && NAMES.has(segment) ? segment : "[REDACTED]") };
    }), types: names(object(c.meta)?.vct_values) };
  }) };
}

export function decodePublicProtocol(value: unknown, origins: ReadonlyMap<string, unknown>): PublicProtocolView {
  const items: PublicProtocolItem[] = [];
  let budget = 256;
  const add = (kind: string, summary: Record<string, unknown>) => { if (items.length < 16) items.push({ kind, summary }); };
  function sdjwt(token: string) {
    const parts = token.split("~").slice(0, 34);
    const claims = jwtPart(parts[0] ?? "", 1);
    if (!claims) return;
    const disclosureNames = parts.slice(1).flatMap((part) => {
      if (!part || part.includes(".") || !/^[A-Za-z0-9_-]+$/.test(part)) return [];
      const disclosure = boundedJson(Buffer.from(part, "base64url").toString("utf8"));
      return Array.isArray(disclosure) && disclosure.length === 3 && allowed(NAMES, disclosure[1]) ? [disclosure[1]] : [];
    });
    add("sd_jwt", { header: header(parts[0] ?? ""), claimNames: Object.keys(claims).filter((name) => NAMES.has(name)), disclosureNames, issuer: endpoint(claims.iss, origins), keyBindingPresent: parts.some((part, i) => i > 0 && part.includes(".")) });
  }
  function requestJwt(token: string) {
    const claims = jwtPart(token, 1);
    if (!claims) return;
    add("request_object", { header: header(token), issuer: endpoint(claims.iss, origins), client: endpoint(claims.client_id, origins), audience: endpoint(claims.aud, origins), noncePresent: typeof claims.nonce === "string", ...(typeof claims.response_mode === "string" && ["direct_post", "direct_post.jwt", "fragment", "query"].includes(claims.response_mode) ? { responseMode: claims.response_mode } : {}) });
    visit(claims, 1);
  }
  function visit(raw: unknown, depth: number) {
    if (depth > 6 || budget-- <= 0 || items.length >= 16) return;
    const v = object(raw);
    if (!v) return;
    if (v.credential_issuer && (v.credential_configuration_ids || v.grants)) {
      add("credential_offer", { issuer: endpoint(v.credential_issuer, origins), configurations: names(v.credential_configuration_ids), grantTypes: Object.keys(object(v.grants) ?? {}).filter((k) => ["authorization_code", "urn:ietf:params:oauth:grant-type:pre-authorized_code"].includes(k)) });
    }
    if (object(v.presentation_definition)) add("presentation_definition", presentationDefinition(v.presentation_definition as Obj));
    const query = object(v.dcql_query ?? v.dcqlQuery);
    if (query) add("dcql", dcql(query));
    if (Array.isArray(v.type) && v.type.includes("VerifiableCredential")) {
      add("verifiable_credential", { types: names(v.type), issuer: endpoint(typeof v.issuer === "string" ? v.issuer : object(v.issuer)?.id, origins), proofTypes: [object(v.proof)?.type].filter((p) => allowed(PROOFS, p)) });
    }
    const checks = Object.fromEntries(["allChecksSuccessful", "credentialChecksSuccessful", "credentialProofValid", "holderProofValid"].filter((k) => typeof v[k] === "boolean").map((k) => [k, v[k]]));
    if (Object.keys(checks).length || allowed(OUTCOMES, v.status) || allowed(ERRORS, v.error)) {
      add("verification_result", { ...checks, ...(allowed(OUTCOMES, v.status) ? { status: v.status } : {}), ...(allowed(ERRORS, v.error) ? { error: v.error } : {}) });
    }
    for (const [key, item] of Object.entries(v).slice(0, 64)) {
      if (key === "credential_offer" && typeof item === "string") visit(boundedJson(item), depth + 1);
      else if (key === "request" && typeof item === "string") requestJwt(item);
      else if (key === "jwt" && typeof item === "string") { const h = header(item); if (h) add("proof_jwt", { header: h }); }
      else if (["credential", "vp_token"].includes(key) && typeof item === "string" && item.includes("~")) sdjwt(item);
      else if (key === "vp_token") { add("presentation", { tokenPresent: item !== null }); visit(item, depth + 1); }
      else if (object(item)) visit(item, depth + 1);
      else if (Array.isArray(item)) for (const element of item.slice(0, 16)) visit(element, depth + 1);
    }
  }
  if (typeof value === "string") {
    if (value.includes("~")) sdjwt(value);
    else requestJwt(value);
  } else visit(value, 0);
  return { schemaVersion: 1, authenticity: "not_verified", items };
}

export function publicViewForHarPart(part: Record<string, unknown>, origins: ReadonlyMap<string, unknown>) {
  const data = object(part.postData ?? part.content);
  if (!data || typeof data.text !== "string" || Buffer.byteLength(data.text) > 131_072) return decodePublicProtocol(null, origins);
  let text = data.text;
  if (data.encoding === "base64") {
    if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(text.replace(/\s/g, ""))) return decodePublicProtocol(null, origins);
    text = Buffer.from(text, "base64").toString("utf8");
  }
  const mime = (typeof data.mimeType === "string" ? data.mimeType : "").split(";")[0]?.trim().toLowerCase();
  if (mime === "application/x-www-form-urlencoded") return decodePublicProtocol(Object.fromEntries(new URLSearchParams(text)), origins);
  const parsed = boundedJson(text);
  return decodePublicProtocol(parsed ?? text, origins);
}
