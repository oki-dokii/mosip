import type { IncomingMessage, ServerResponse } from "node:http";
import { createScanner, SyntaxKind, visit } from "jsonc-parser";

export class InputError extends Error {
  constructor(readonly status: number, readonly code: string) { super(code); }
}
export function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
export function parseJson(text: string): unknown {
  const scanner = createScanner(text, false);
  let depth = 0;
  for (let token = scanner.scan(); token !== SyntaxKind.EOF; token = scanner.scan()) {
    if (token === SyntaxKind.OpenBraceToken || token === SyntaxKind.OpenBracketToken) {
      if (++depth > 16) throw new InputError(400, "invalid_json");
    }
    if (token === SyntaxKind.CloseBraceToken || token === SyntaxKind.CloseBracketToken) depth--;
  }
  const stack: Set<string>[] = [];
  let count = 0;
  visit(text, {
    onObjectBegin() { if (++count > 512) throw new InputError(400, "invalid_json"); stack.push(new Set()); },
    onArrayBegin() { if (++count > 512) throw new InputError(400, "invalid_json"); },
    onObjectEnd() { stack.pop(); },
    onObjectProperty(name) {
      const names = stack.at(-1)!;
      if (names.has(name) || ++count > 512) throw new InputError(400, "invalid_json");
      names.add(name);
    },
    onLiteralValue() { if (++count > 512) throw new InputError(400, "invalid_json"); },
    onError() { throw new InputError(400, "invalid_json"); },
  }, { disallowComments: true, allowTrailingComma: false, allowEmptyContent: false });
  return JSON.parse(text);
}
export function decodeJson(encoded: string, maxBytes = 16_384): unknown {
  if (!encoded || encoded.length > Math.ceil(maxBytes * 4 / 3) || !/^[A-Za-z0-9_-]+$/.test(encoded)) throw new InputError(400, "invalid_encoding");
  const bytes = Buffer.from(encoded, "base64url");
  if (bytes.length > maxBytes || bytes.toString("base64url") !== encoded) throw new InputError(400, "invalid_encoding");
  return parseJson(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
}
export async function readInput(request: IncomingMessage, limit: number): Promise<Record<string, unknown>> {
  const mime = request.headers["content-type"]?.split(";")[0]?.trim().toLowerCase();
  if (mime !== "application/json" && mime !== "application/x-www-form-urlencoded") throw new InputError(415, "unsupported_media_type");
  const declared = Number(request.headers["content-length"] ?? 0);
  if (declared > limit) { request.resume(); throw new InputError(413, "request_too_large"); }
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const part of request.iterator({ destroyOnReturn: false })) {
    const chunk = Buffer.from(part);
    total += chunk.length;
    if (total > limit) { request.resume(); throw new InputError(413, "request_too_large"); }
    chunks.push(chunk);
  }
  let text: string;
  try { text = new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(chunks)); }
  catch { throw new InputError(400, "invalid_encoding"); }
  if (mime === "application/json") {
    const value = parseJson(text);
    if (!object(value)) throw new InputError(400, "invalid_request");
    return value;
  }
  const result: Record<string, unknown> = Object.create(null);
  for (const [key, value] of new URLSearchParams(text)) {
    if (Object.hasOwn(result, key)) throw new InputError(400, "duplicate_parameter");
    result[key] = value;
  }
  return result;
}
export function send(response: ServerResponse, status: number, value: unknown) {
  response.writeHead(status, { "content-type": "application/json", "cache-control": "no-store" });
  response.end(JSON.stringify(value));
}
