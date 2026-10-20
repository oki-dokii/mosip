const SECRET_FIELDS = new Set([
  "access_token",
  "refresh_token",
  "c_nonce",
  "pre-authorized_code",
  "client_assertion",
  "code_verifier",
  "authorization",
  "cookie",
  "set-cookie",
  "d",
]);

export function redact(value: unknown, path = "$", redactions: string[] = []): { value: unknown; redactions: string[] } {
  if (Array.isArray(value)) {
    return {
      value: value.map((item, index) => redact(item, `${path}[${index}]`, redactions).value),
      redactions,
    };
  }
  if (value && typeof value === "object") {
    const output: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) {
      const itemPath = `${path}.${key}`;
      if (SECRET_FIELDS.has(key.toLowerCase())) {
        output[key] = "[REDACTED]";
        redactions.push(itemPath);
      } else {
        output[key] = redact(item, itemPath, redactions).value;
      }
    }
    return { value: output, redactions };
  }
  return { value, redactions };
}
