import { describe, expect, it } from "vitest";
import { CAPTURE_RULES, tagCapture } from "./tagging.js";

describe("ordered capture tagging", () => {
  for (const rule of CAPTURE_RULES) {
    it(`${rule.id}: ${rule.why}`, () => {
      expect(tagCapture(rule.service, rule.method, rule.example)?.id).toBe(rule.id);
      expect(tagCapture(rule.service, "DELETE", rule.example)).toBeNull();
    });
  }
  it("leaves unrelated paths, eSignet login, and consent untagged", () => {
    for (const path of ["/oauth/authorize", "/login", "/authenticate", "/consent", "/oauth/token-history"]) {
      expect(tagCapture("esignet", "POST", path)).toBeNull();
    }
    expect(tagCapture("certify", "POST", "/not-a-credential-endpoint")).toBeNull();
    expect(tagCapture("verify", "GET", "/assets/status-result.js")).toBeNull();
  });
  it("does not classify a status subresource as a request fetch", () => {
    expect(tagCapture("verify", "GET", "/v1/verify/vp-request/id/status")?.stepKey).toBe("PRESENT_STATUS");
  });
  it("maps the four hosted paths without guessing adjacent wallet or Verify resources", () => {
    expect(tagCapture("mimoto", "POST", "/v1/mimoto/wallets/private-id/credentials")?.id).toBe("mimoto-wallet-credential");
    expect(tagCapture("mimoto", "POST", "/v1/mimoto/wallets/private-id/presentations")?.id).toBe("mimoto-wallet-presentation");
    expect(tagCapture("verify", "POST", "/v1/verify/v2/vp-session-request")?.id).toBe("verify-session-request");
    expect(tagCapture("verify", "POST", "/v1/verify/vp-session-results")?.id).toBe("verify-session-results");
    expect(tagCapture("mimoto", "POST", "/v1/mimoto/wallets/private-id/credential-types")).toBeNull();
    expect(tagCapture("verify", "POST", "/v1/verify/vp-session-results/private-id")).toBeNull();
  });
});
