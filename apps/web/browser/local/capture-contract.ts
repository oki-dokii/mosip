import type { Exchange } from "@playground/shared";

const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
// Consume only the currently published browser bridge contract. Person 1's
// server-hop proxy mapping is not published; never guess server-hop attribution.
export function browserCaptureReferences(runId: string, exchanges: readonly Exchange[]) {
  if (!uuid.test(runId)) throw new Error("PERSON2_CAPTURE_RUN_ID_INVALID");
  const references = (ruleId: string) => exchanges.filter(exchange => {
    const request = exchange.request as { source?: string; capture?: { ruleId?: string } } | null;
    return exchange.runId === runId && uuid.test(exchange.id) && exchange.method === "POST" && exchange.actorFrom === "browser" && exchange.actorTo === "mimoto" &&
      ["live_bridge", "har_import"].includes(request?.source ?? "") && request?.capture?.ruleId === ruleId && exchange.status >= 200 && exchange.status < 300;
  }).map(exchange => exchange.id);
  return { runId, browserIssuanceExchangeIds: references("mimoto-wallet-credential"), browserPresentationExchangeIds: references("mimoto-wallet-presentation"),
    downstreamCertify: "not_observed" as const, downstreamVerify: "not_observed" as const,
    storageConfirmed: false, verifierOutcome: "not_established" as const };
}
