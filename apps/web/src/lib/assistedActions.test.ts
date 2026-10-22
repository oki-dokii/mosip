import { expect, it } from "vitest";
import { actionUrl } from "./assistedActions";

it.each([undefined, "", "javascript:alert(1)", "data:text/html,hello", "http://wallet.example/", "https://user:password@wallet.example/", "//wallet.example/", "#bad fragment", "openid4vp://authorize?request=inline-token", "openid4vp://authorize?request_uri=http://verifier.example/request"])("withholds unsupported action %s", (value) => {
  expect(actionUrl(value)).toBeNull();
});
it("supports local fixture anchors, HTTPS and referenced same-device requests", () => {
  expect(actionUrl("#fixture-wallet")).toBe("#fixture-wallet");
  expect(actionUrl("https://wallet.example/")).toBe("https://wallet.example/");
  const link = "openid4vp://authorize?request_uri=https%3A%2F%2Fverifier.example%2Frequest";
  expect(actionUrl(link)).toBe(link);
});
