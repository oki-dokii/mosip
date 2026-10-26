import { afterEach, expect, it, vi } from "vitest";
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

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
it("allows only exact local wallet routes in the explicit synthetic local build", () => {
  expect(actionUrl("http://127.0.0.1:18093/")).toBeNull();
  vi.stubEnv("VITE_ASSISTED_LOCAL_PROFILE", "jsonld-0.14");
  vi.stubGlobal("window", { location: { hostname: "localhost" } });
  expect(actionUrl("http://127.0.0.1:18093/")).toBe("http://127.0.0.1:18093/");
  expect(actionUrl("http://127.0.0.1:18093/user/authorize?request=synthetic")).toBeTruthy();
  for (const value of ["http://localhost:18093/", "http://127.0.0.1:18093/other", "http://127.0.0.1:18093/#secret", "http://127.0.0.1:18094/", "http://169.254.169.254/"]) expect(actionUrl(value)).toBeNull();
});
