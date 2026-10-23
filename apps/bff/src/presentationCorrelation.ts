import type { Exchange } from "@playground/shared";
export function matchesPresentation(exchange: Exchange, expectedTag: string | undefined, verifierBase: string): boolean {
  if (!expectedTag || !/^\[REDACTED hmac:[a-f0-9]{16}\]$/.test(expectedTag)) return false;
  const request = exchange.request as { body?: { state?: unknown } } | null;
  try { return request?.body?.state === expectedTag && new URL(exchange.url).origin === new URL(verifierBase).origin; } catch { return false; }
}

export function matchesMimotoPresentation(exchange: Exchange, expectedRequestUriTag: string | undefined, walletBase: string): boolean {
  if (!expectedRequestUriTag || !/^\[REDACTED hmac:[a-f0-9]{16}\]$/.test(expectedRequestUriTag)) return false;
  const request = exchange.request as { source?: unknown; capture?: { ruleId?: unknown; requestUriTag?: unknown; downstreamVerifyObserved?: unknown } } | null;
  try {
    return exchange.actorFrom === "browser" && exchange.actorTo === "mimoto" && request?.source === "live_bridge" &&
      request.capture?.ruleId === "mimoto-wallet-presentation" && request.capture.requestUriTag === expectedRequestUriTag &&
      request.capture.downstreamVerifyObserved === false && new URL(exchange.url).origin === new URL(walletBase).origin;
  } catch { return false; }
}

// Deployment-specific Web launch route: never assume a native URI opens Inji Web.
export function webPresentationLink(template: string | undefined, requestLink: string): string | null {
  if (!template || template.split("{request_uri}").length !== 2) return null;
  try {
    const reference = new URL(requestLink).searchParams.get("request_uri");
    if (!reference) return null;
    const request = new URL(reference);
    if (request.protocol !== "https:" || request.username || request.password) return null;
    const launch = new URL(template.replace("{request_uri}", encodeURIComponent(request.href)));
    return launch.protocol === "https:" && !launch.username && !launch.password ? launch.href : null;
  } catch { return null; }
}
