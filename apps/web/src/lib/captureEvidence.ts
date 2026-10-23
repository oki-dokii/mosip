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
