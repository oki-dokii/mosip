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
});
