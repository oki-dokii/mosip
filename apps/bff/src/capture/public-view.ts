// Decode only in memory, then project an explicit vocabulary. Never return raw signed objects.
const NAMES = new Set([
  "VerifiableCredential", "VerifiablePresentation", "FarmerCredential", "MockVerifiableCredential",
  "FarmerCredential_VCDM2.0", "MockVerifiableCredential_SD_JWT", "MockVerifiableCredential_LDP_VC",
  "given_name", "family_name", "name", "birthdate", "age_over_18", "email", "address",
  "credentialSubject", "type", "issuer", "iss", "aud", "iat", "exp", "nbf", "vct", "cnf",
  "_sd", "_sd_alg", "sub", "nonce", "jti", "credential", "id", "nationality",
]);
// Public vocabulary only. A claim's value is never included, even if it is itself a known name.
export const SUBJECT_NAMES = ["id", "type", "given_name", "family_name", "name", "birthdate", "age_over_18", "email", "address", "nationality", "fullName", "farmerID", "streetAddress", "addressLocality", "postalCode", "addressCountry"] as const;
const subjectNames = new Set<string>(SUBJECT_NAMES);
export function projectSubject(value: unknown) {
  const result = { names: [] as string[], paths: [] as string[], withheldNames: 0, truncatedItems: 0 };
  let remaining = 128;
  function walk(raw: unknown, path: string, depth: number) {
    if (depth > 4 || remaining-- <= 0) { result.truncatedItems++; return; }
    if (Array.isArray(raw)) {
      if (raw.length > 8) result.truncatedItems += raw.length - 8;
      for (const item of raw.slice(0, 8)) walk(item, path + "[*]", depth + 1);
      return;
    }
    if (!raw || typeof raw !== "object") return;
    const entries = Object.entries(raw);
    if (entries.length > 32) result.truncatedItems += entries.length - 32;
    for (const [name, child] of entries.slice(0, 32)) {
      if (!subjectNames.has(name)) { result.withheldNames++; continue; }
      if (result.paths.length >= 32) { result.truncatedItems++; continue; }
      const next = path + "." + name;
      if (!result.names.includes(name)) result.names.push(name);
      if (!result.paths.includes(next)) result.paths.push(next);
      if (child && typeof child === "object") walk(child, next, depth + 1);
    }
  }
  walk(value, "$.credentialSubject", 0);
  return result;
}
const FORMATS = new Set(["vc+sd-jwt", "dc+sd-jwt", "ldp_vc", "jwt_vc_json", "mso_mdoc"]);
const ALGORITHMS = new Set(["EdDSA", "ES256", "ES384", "RS256", "PS256", "none"]);
const TYPES = new Set(["JWT", "oauth-authz-req+jwt", "openid4vci-proof+jwt", "kb+jwt", "vc+sd-jwt", "dc+sd-jwt"]);
const PROOFS = new Set(["Ed25519Signature2020", "Ed25519Signature2018", "DataIntegrityProof", "JsonWebSignature2020"]);
const OUTCOMES = new Set(["valid", "invalid", "expired", "error", "pending", "VP_SUBMITTED", "SUCCESS", "FAILED"]);
const ERRORS = new Set(["invalid_request", "invalid_token", "invalid_grant", "access_denied", "invalid_proof", "unsupported_credential_format"]);
const allowed = (set: ReadonlySet<string>, value: unknown): value is string => typeof value === "string" && set.has(value);
type Obj = Record<string, unknown>;
export interface PublicProtocolItem { kind: string; summary: Record<string, unknown> }
export interface PublicProtocolView { schemaVersion: 1; authenticity: "not_verified"; items: PublicProtocolItem[]; withheldNames: number; truncatedItems: number; unsupportedKinds: number }
type ProjectionCounts = { withheldNames: number; truncatedItems: number; unsupportedKinds: number };
const object = (v: unknown): Obj | null => v !== null && typeof v === "object" && !Array.isArray(v) ? v as Obj : null;
const array = (v: unknown, counts?: ProjectionCounts): unknown[] => { if (!Array.isArray(v)) return []; if (counts && v.length > 32) counts.truncatedItems += v.length - 32; return v.slice(0, 32); };
const names = (v: unknown, counts?: ProjectionCounts): string[] => array(v, counts).filter((s): s is string => { if (typeof s !== "string") return false; if (NAMES.has(s)) return true; if (counts) counts.withheldNames++; return false; });
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
function presentationDefinition(v: Obj, counts: ProjectionCounts) {
  return { descriptors: array(v.input_descriptors, counts).map((raw) => {
    const d = object(raw) ?? {};
    const c = object(d.constraints) ?? {};
    return { formats: Object.keys(object(d.format) ?? {}).filter((f) => FORMATS.has(f)), fields: array(c.fields, counts).map((rawField) => {
      const field = object(rawField) ?? {};
      const filter = object(field.filter) ?? {};
      return { paths: constraints(field.path), ...(typeof filter.type === "string" && ["string", "number", "boolean", "array"].includes(filter.type) ? { type: filter.type } : {}), allowedTypes: names(filter.enum, counts), ...(allowed(NAMES, filter.const) ? { const: filter.const } : {}) };
    }) };
  }) };
}
function dcql(v: Obj, counts: ProjectionCounts) {
  return { credentials: array(v.credentials, counts).map((raw) => {
    const c = object(raw) ?? {};
    return { ...(format(c.format) ? { format: c.format } : {}), claims: array(c.claims, counts).map((rawClaim) => {
      const claim = object(rawClaim) ?? {};
      return { path: array(claim.path, counts).map((segment) => typeof segment === "string" && NAMES.has(segment) ? segment : "[REDACTED]") };
    }), types: names(object(c.meta)?.vct_values, counts) };
  }) };
}

export function decodePublicProtocol(value: unknown, origins: ReadonlyMap<string, unknown>): PublicProtocolView {
  const items: PublicProtocolItem[] = [];
  let budget = 256;
  const counts: ProjectionCounts = { withheldNames: 0, truncatedItems: 0, unsupportedKinds: 0 };
  const add = (kind: string, summary: Record<string, unknown>) => { if (items.length < 16) items.push({ kind, summary }); else counts.truncatedItems++; };
  function sdjwt(token: string) {
    const allParts = token.split("~");
    if (allParts.length > 34) counts.truncatedItems += allParts.length - 34;
    const parts = allParts.slice(0, 34);
    const claims = jwtPart(parts[0] ?? "", 1);
    if (!claims) { counts.unsupportedKinds++; return; }
    const disclosureNames = parts.slice(1).flatMap((part) => {
      if (!part || part.includes(".") || !/^[A-Za-z0-9_-]+$/.test(part)) return [];
      const disclosure = boundedJson(Buffer.from(part, "base64url").toString("utf8"));
      if (!Array.isArray(disclosure) || disclosure.length !== 3 || typeof disclosure[1] !== "string") return [];
      if (!NAMES.has(disclosure[1])) { counts.withheldNames++; return []; }
      return [disclosure[1]];
    });
    add("sd_jwt", { header: header(parts[0] ?? ""), claimNames: names(Object.keys(claims), counts), disclosureNames, issuer: endpoint(claims.iss, origins), keyBindingPresent: parts.some((part, i) => i > 0 && part.includes(".")) });
  }
  function requestJwt(token: string) {
    const claims = jwtPart(token, 1);
    if (!claims) return;
    add("request_object", { header: header(token), issuer: endpoint(claims.iss, origins), client: endpoint(claims.client_id, origins), audience: endpoint(claims.aud, origins), noncePresent: typeof claims.nonce === "string", ...(typeof claims.response_mode === "string" && ["direct_post", "direct_post.jwt", "fragment", "query"].includes(claims.response_mode) ? { responseMode: claims.response_mode } : {}) });
    visit(claims, 1);
  }
  function visit(raw: unknown, depth: number) {
    if (depth > 6 || budget-- <= 0 || items.length >= 16) { counts.truncatedItems++; return; }
    const v = object(raw);
    if (!v) return;
    if (v.credential_issuer && (v.credential_configuration_ids || v.grants)) {
      add("credential_offer", { issuer: endpoint(v.credential_issuer, origins), configurations: names(v.credential_configuration_ids, counts), grantTypes: Object.keys(object(v.grants) ?? {}).filter((k) => ["authorization_code", "urn:ietf:params:oauth:grant-type:pre-authorized_code"].includes(k)) });
    }
    if (object(v.presentation_definition)) add("presentation_definition", presentationDefinition(v.presentation_definition as Obj, counts));
    const query = object(v.dcql_query ?? v.dcqlQuery);
    if (query) add("dcql", dcql(query, counts));
    if (Array.isArray(v.type) && v.type.includes("VerifiableCredential")) {
      add("verifiable_credential", { types: names(v.type, counts), issuer: endpoint(typeof v.issuer === "string" ? v.issuer : object(v.issuer)?.id, origins), proofTypes: [object(v.proof)?.type].filter((p) => allowed(PROOFS, p)), subject: projectSubject(v.credentialSubject) });
    }
    if (v.credentialSubject) { const subject = projectSubject(v.credentialSubject); counts.withheldNames += subject.withheldNames; counts.truncatedItems += subject.truncatedItems; }
    if (v.format === "mso_mdoc") counts.unsupportedKinds++;
    const checks = Object.fromEntries(["allChecksSuccessful", "credentialChecksSuccessful", "credentialProofValid", "holderProofValid"].filter((k) => typeof v[k] === "boolean").map((k) => [k, v[k]]));
    if (Object.keys(checks).length || allowed(OUTCOMES, v.status) || allowed(ERRORS, v.error)) {
      add("verification_result", { ...checks, ...(allowed(OUTCOMES, v.status) ? { status: v.status } : {}), ...(allowed(ERRORS, v.error) ? { error: v.error } : {}) });
    }
    const entries = Object.entries(v);
    if (entries.length > 64) counts.truncatedItems += entries.length - 64;
    for (const [key, item] of entries.slice(0, 64)) {
      if (key === "credential_offer" && typeof item === "string") visit(boundedJson(item), depth + 1);
      else if (key === "request" && typeof item === "string") requestJwt(item);
      else if (key === "jwt" && typeof item === "string") { const h = header(item); if (h) add("proof_jwt", { header: h }); }
      else if (["credential", "vp_token"].includes(key) && typeof item === "string" && item.includes("~")) sdjwt(item);
      else if (key === "credential" && typeof item === "string") counts.unsupportedKinds++;
      else if (key === "vp_token") { add("presentation", { tokenPresent: item !== null }); visit(item, depth + 1); }
      else if (object(item)) visit(item, depth + 1);
      else if (Array.isArray(item)) { if (item.length > 16) counts.truncatedItems += item.length - 16; for (const element of item.slice(0, 16)) visit(element, depth + 1); }
    }
  }
  if (typeof value === "string") {
    if (value.includes("~")) sdjwt(value);
    else requestJwt(value);
  } else visit(value, 0);
  return { schemaVersion: 1, authenticity: "not_verified", items, ...counts };
}

export function publicViewForHarPart(part: Record<string, unknown>, origins: ReadonlyMap<string, unknown>) {
  const data = object(part.postData ?? part.content);
  if (!data || typeof data.text !== "string") return decodePublicProtocol(null, origins);
  if (Buffer.byteLength(data.text) > 131_072) return { ...decodePublicProtocol(null, origins), truncatedItems: 1 };
  let text = data.text;
  if (data.encoding === "base64") {
    if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(text.replace(/\s/g, ""))) return decodePublicProtocol(null, origins);
    text = Buffer.from(text, "base64").toString("utf8");
  }
  const mime = (typeof data.mimeType === "string" ? data.mimeType : "").split(";")[0]?.trim().toLowerCase();
  if (mime === "application/cbor" || mime === "application/mdoc" || mime === "application/vnd.mdl") return { ...decodePublicProtocol(null, origins), unsupportedKinds: 1 };
  if (mime === "application/x-www-form-urlencoded") return decodePublicProtocol(Object.fromEntries(new URLSearchParams(text)), origins);
  const parsed = boundedJson(text);
  return decodePublicProtocol(parsed ?? text, origins);
}

// Narrow server-hop projection: no endpoint identifiers, JWT headers or arbitrary names.
export function serverHopPublicView(value: unknown) {
  const full = decodePublicProtocol(value, new Map());
  return { ...full, items: full.items.filter(item => ["verifiable_credential", "presentation", "verification_result"].includes(item.kind)).map(item => {
    if (item.kind === "verifiable_credential") return { kind: item.kind, summary: { types: item.summary.types, proofTypes: item.summary.proofTypes, subject: item.summary.subject } };
    if (item.kind === "presentation") return { kind: item.kind, summary: { tokenPresent: true } };
    return { kind: item.kind, summary: Object.fromEntries(Object.entries(item.summary).filter(([key]) => ["allChecksSuccessful", "credentialChecksSuccessful", "credentialProofValid", "holderProofValid"].includes(key))) };
  }) };
}
export function validServerHopView(value: unknown): boolean {
  const v = object(value);
  const exact = (o: Obj, keys: string[]) => Object.keys(o).every(key => keys.includes(key));
  const count = (n: unknown) => Number.isSafeInteger(n) && Number(n) >= 0 && Number(n) <= 10_000_000;
  const list = (v: unknown, predicate: (s: unknown) => boolean, max = 32) => Array.isArray(v) && v.length <= max && v.every(predicate);
  if (!v || !exact(v, ["schemaVersion", "authenticity", "items", "withheldNames", "truncatedItems", "unsupportedKinds"]) || v.schemaVersion !== 1 || v.authenticity !== "not_verified" || ![v.withheldNames, v.truncatedItems, v.unsupportedKinds].every(count)) return false;
  return list(v.items, raw => {
    const item = object(raw), summary = object(item?.summary);
    if (!item || !summary || !exact(item, ["kind", "summary"])) return false;
    if (item.kind === "presentation") return exact(summary, ["tokenPresent"]) && summary.tokenPresent === true;
    if (item.kind === "verification_result") return exact(summary, ["allChecksSuccessful", "credentialChecksSuccessful", "credentialProofValid", "holderProofValid"]) && Object.values(summary).every(v => typeof v === "boolean");
    if (item.kind !== "verifiable_credential" || !exact(summary, ["types", "proofTypes", "subject"])) return false;
    const subject = object(summary.subject);
    return list(summary.types, v => allowed(NAMES, v)) && list(summary.proofTypes, v => allowed(PROOFS, v)) && !!subject && exact(subject, ["names", "paths", "withheldNames", "truncatedItems"]) && count(subject.withheldNames) && count(subject.truncatedItems) && list(subject.names, v => typeof v === "string" && subjectNames.has(v)) && list(subject.paths, v => {
      if (typeof v !== "string" || v.length > 256 || !v.startsWith("$.credentialSubject")) return false;
      return /^(?:\[\*\])?(?:\.[A-Za-z_][A-Za-z0-9_]*(?:\[\*\])?){1,5}$/.test(v.slice(19)) && v.slice(19).replace(/\[\*\]/g, "").split(".").slice(1).every(name => subjectNames.has(name));
    });
  }, 16);
}
