import { object, publicView } from "./captureEvidence";

// Vocabulary published by capture/public-view.ts. Unknown names are never displayed.
const names = new Set("VerifiableCredential VerifiablePresentation FarmerCredential MockVerifiableCredential FarmerCredential_VCDM2.0 MockVerifiableCredential_SD_JWT MockVerifiableCredential_LDP_VC given_name family_name name birthdate age_over_18 email address credentialSubject type issuer iss aud iat exp nbf vct cnf _sd _sd_alg sub nonce jti credential id nationality".split(" "));
const formats = new Set(["vc+sd-jwt", "dc+sd-jwt", "ldp_vc", "jwt_vc_json", "mso_mdoc"]);
const proofs = new Set(["Ed25519Signature2020", "Ed25519Signature2018", "DataIntegrityProof", "JsonWebSignature2020"]);
const algorithms = new Set(["EdDSA", "ES256", "ES384", "RS256", "PS256", "none"]);
const select = (value: unknown, allowed: Set<string>) => (Array.isArray(value) ? value : [value]).slice(0, 64).filter((v): v is string => typeof v === "string" && allowed.has(v));
export interface StructureItem { kind: string; rows: Array<{ label: string; values: string[] }> }

/** Only reads publicView; never inspects credential bodies, JWTs, tokens or values. */
export function publicStructure(value: unknown) {
  const view = publicView(object(value)?.publicView);
  if (!view) return null;
  const items: StructureItem[] = view.items.map(({ kind, summary: s }) => {
    const rows: StructureItem["rows"] = [];
    const add = (label: string, values: string[]) => { if (values.length) rows.push({ label, values }); };
    const header = object(s.header);
    add("Algorithm", select(header?.alg, algorithms));
    if (kind === "sd_jwt") {
      add("Claim names", select(s.claimNames, names));
      add("Disclosure names", select(s.disclosureNames, names));
    }
    if (kind === "verifiable_credential") {
      add("Credential types", select(s.types, names));
      add("Proof types", select(s.proofTypes, proofs));
      add("Subject structure", ["Claim names are unavailable in this JSON-LD projection; claim values are never displayed."]);
    }
    if (kind === "credential_offer") add("Configurations", select(s.configurations, names));
    if (kind === "dcql" && Array.isArray(s.credentials)) {
      s.credentials.slice(0, 16).forEach((raw, index) => {
        const credential = object(raw);
        add(`Credential ${index + 1} format`, select(credential?.format, formats));
        add(`Credential ${index + 1} types`, select(credential?.types, names));
        if (Array.isArray(credential?.claims)) credential.claims.slice(0, 32).forEach((rawClaim) => {
          const path = object(rawClaim)?.path;
          // Withheld segments suppress the whole path, including partial names.
          if (Array.isArray(path) && path.length > 0 && path.length <= 16 && path.every(p => typeof p === "string" && names.has(p))) add(`Credential ${index + 1} claim path`, [path.join(" → ")]);
        });
      });
    }
    if (kind === "presentation_definition" && Array.isArray(s.descriptors)) s.descriptors.slice(0, 16).forEach((raw, index) => {
      const descriptor = object(raw);
      add(`Descriptor ${index + 1} formats`, select(descriptor?.formats, formats));
      if (Array.isArray(descriptor?.fields)) descriptor.fields.slice(0, 32).forEach(rawField => {
        const field = object(rawField);
        const paths = Array.isArray(field?.paths) ? field.paths.slice(0, 16).filter((p): p is string => typeof p === "string" && /^\$\.(?:credentialSubject\.)?(?:type|given_name|family_name|birthdate|age_over_18|nationality)$/.test(p)) : [];
        add(`Descriptor ${index + 1} field paths`, paths);
        add("Field shape", select(field?.type, new Set(["string", "number", "boolean", "array"])));
        add("Allowed credential types", select(field?.allowedTypes, names));
      });
    });
    for (const key of ["keyBindingPresent", "tokenPresent", "noncePresent"]) if (typeof s[key] === "boolean") add(key, [s[key] ? "present" : "absent"]);
    return { kind, rows };
  });
  return { withheldNames: view.withheldNames, truncatedItems: view.truncatedItems, unsupportedKinds: view.unsupportedKinds, items };
}
