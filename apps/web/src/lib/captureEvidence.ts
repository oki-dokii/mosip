export const object = (value: unknown): Record<string, unknown> | null => value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
export const count = (value: unknown): number | null => typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : null;
export interface Projection { withheldNames: number; truncatedItems: number; unsupportedKinds: number }
export function projection(value: unknown): Projection | null {
  const item = object(value);
  if (!item || ["withheldNames", "truncatedItems", "unsupportedKinds"].some((key) => count(item[key]) === null)) return null;
  return { withheldNames: item.withheldNames as number, truncatedItems: item.truncatedItems as number, unsupportedKinds: item.unsupportedKinds as number };
}
export interface PublicView extends Projection { items: Array<{ kind: string; summary: Record<string, unknown> }> }
const kinds = new Set(["sd_jwt", "request_object", "credential_offer", "presentation_definition", "dcql", "verifiable_credential", "verification_result", "proof_jwt", "presentation"]);
export function publicView(value: unknown): PublicView | null {
  const item = object(value); const totals = projection(value);
  if (!item || !totals || item.schemaVersion !== 1 || item.authenticity !== "not_verified" || !Array.isArray(item.items) || item.items.length > 16) return null;
  const items: PublicView["items"] = [];
  for (const raw of item.items) {
    const entry = object(raw); const summary = object(entry?.summary);
    if (!entry || typeof entry.kind !== "string" || !kinds.has(entry.kind) || !summary || JSON.stringify(summary).length > 32_768) return null;
    items.push({ kind: entry.kind, summary });
  }
  return { ...totals, items };
}
export interface Coverage { stepKey: string; state: "captured" | "missing" | "not_observable"; count: number; reason: string; projection: Projection }
export function coverage(value: unknown): Coverage[] | null {
  if (!Array.isArray(value) || value.length > 100) return null;
  const rows: Coverage[] = [];
  for (const raw of value) {
    const row = object(raw); const totals = projection(row?.projection);
    if (!row || !totals || typeof row.stepKey !== "string" || typeof row.reason !== "string" || count(row.count) === null || !["captured", "missing", "not_observable"].includes(String(row.state))) return null;
    rows.push({ stepKey: row.stepKey, state: row.state as Coverage["state"], count: row.count as number, reason: row.reason, projection: totals });
  }
  return rows;
}

export interface ServerHop { ruleId: string; state: "observed" | "not_observed"; exchangeIds: string[]; actorFrom: "mimoto"; actorTo: "certify" | "verify" }
const serverRules: Record<string, ServerHop["actorTo"]> = { "certify-token": "certify", "certify-credential": "certify", "verify-request-fetch": "verify", "verify-submit": "verify" };
export function serverCoverage(value: unknown): ServerHop[] | null {
  if (!Array.isArray(value) || value.length > 4) return null;
  const rows: ServerHop[] = [];
  for (const raw of value) {
    const row = object(raw);
    if (!row || typeof row.ruleId !== "string" || !Object.hasOwn(serverRules, row.ruleId) || row.actorFrom !== "mimoto" || row.actorTo !== serverRules[row.ruleId] || !["observed", "not_observed"].includes(String(row.state)) || !Array.isArray(row.exchangeIds) || row.exchangeIds.length > 100 || !row.exchangeIds.every(id => typeof id === "string" && /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/.test(id))) return null;
    if ((row.state === "observed") !== (row.exchangeIds.length > 0) || rows.some(item => item.ruleId === row.ruleId)) return null;
    rows.push({ ruleId: row.ruleId, state: row.state as ServerHop["state"], actorFrom: "mimoto", actorTo: serverRules[row.ruleId]!, exchangeIds: row.exchangeIds as string[] });
  }
  return rows;
}
