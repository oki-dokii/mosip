// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { emptyFilters, locationQuery, parseLocation, useArchiveLocation } from "./archiveLocation";
const id = "11111111-1111-4111-8111-111111111111";
const versions = { issuer: ["fixture/1"], verifier: ["v2"] };
afterEach(() => { cleanup(); window.history.replaceState(null, "", "/"); });
it("drops unknown fields, duplicate IDs/enums, malformed IDs, arbitrary versions and secrets", () => {
  const state = parseLocation(`?run=${id}&run=${id}&compareA=../../secret&status=passed&status=failed&wallet=android&issuerVersion=secret&state=secret&request_uri=secret&token=secret`, versions);
  expect(locationQuery(state, versions)).toBe("");
  expect(state.filters).toEqual(emptyFilters);
});
it("round trips only known fields, UUIDs and recorded versions", () => {
  const query = `?view=matrix&run=${id}&compareA=${id}&format=ldp_vc&status=cancelled&issuerVersion=fixture%2F1`;
  expect(locationQuery(parseLocation(query, versions), versions)).toBe(query);
});
it("preserves an authorized version filter during asynchronous archive loading and restores popstate", async () => {
  window.history.replaceState(null, "", `/?issuerVersion=fixture%2F1&state=secret#token`);
  const { result, rerender } = renderHook(({ ready }) => useArchiveLocation(versions, ready), { initialProps: { ready: false } });
  expect(window.location.href).not.toContain("secret");
  rerender({ ready: true });
  await waitFor(() => expect(window.location.search).toContain("issuerVersion"));
  act(() => result.current.update({ view: "matrix", run: id }));
  expect(result.current.state.run).toBe(id);
  act(() => { window.history.replaceState(null, "", "/?status=failed&token=private"); window.dispatchEvent(new PopStateEvent("popstate")); });
  expect(result.current.state.run).toBe("");
  expect(result.current.state.filters.status).toBe("failed");
  expect(window.location.search).toBe("?status=failed");
});
