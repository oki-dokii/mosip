// Transient interaction URLs, separate from persisted/redacted exchange evidence.
export interface AssistedActions {
  walletUrl?: string;
  offerUrl?: string;
  presentationUrl?: string;
}

export function actionUrl(value: string | undefined): string | null {
  if (!value || value !== value.trim()) return null;
  if (/^#[A-Za-z][A-Za-z0-9_-]*$/.test(value)) return value;
  try {
    const url = new URL(value);
    if (url.username || url.password) return null;
    if (url.protocol === "https:") return url.href;
    // Explicit synthetic local build only; never relax the hosted action policy.
    if (import.meta.env.VITE_ASSISTED_LOCAL_PROFILE === "jsonld-0.14" &&
      typeof window !== "undefined" && ["localhost", "127.0.0.1"].includes(window.location.hostname) &&
      url.origin === "http://127.0.0.1:18093" && !url.hash &&
      ["/", "/issuers/LocalFarmer", "/user/authorize"].includes(url.pathname)) return url.href;
    // Same-device launch via a referenced request, never an inline signed token.
    if (url.protocol === "openid4vp:" && url.searchParams.size === 1) {
      const request = new URL(url.searchParams.get("request_uri") ?? "");
      if (request.protocol === "https:" && !request.username && !request.password) return url.href;
    }
  } catch { /* Missing/malformed actions render as unavailable. */ }
  return null;
}
