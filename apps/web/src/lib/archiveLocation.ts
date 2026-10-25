import { useCallback, useEffect, useRef, useState } from "react";
import type { RunSummary } from "@playground/shared";

export const filterChoices = {
  issuer: ["inji_certify", "mock_issuer"], wallet: ["reference_wallet", "inji_web_assisted"],
  verifier: ["inji_verify", "mock_verifier"], format: ["ldp_vc", "vc_sd_jwt"],
  status: ["pending", "running", "passed", "failed", "errored", "cancelled"],
};
export type Filters = Record<keyof typeof filterChoices | "issuerVersion" | "verifierVersion", string>;
export interface ArchiveLocation { view: "history" | "matrix"; run: string; compareA: string; compareB: string; filters: Filters }
export const emptyFilters: Filters = { issuer: "", wallet: "", verifier: "", format: "", status: "", issuerVersion: "", verifierVersion: "" };
export const isRunId = (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
export type Versions = { issuer: string[]; verifier: string[] };
export function versionsFor(runs: RunSummary[]): Versions {
  return { issuer: [...new Set(runs.flatMap(r => r.serviceVersions?.issuer ? [r.serviceVersions.issuer] : []))].sort(), verifier: [...new Set(runs.flatMap(r => r.serviceVersions?.verifier ? [r.serviceVersions.verifier] : []))].sort() };
}
export function parseLocation(search: string, versions?: Versions): ArchiveLocation {
  const query = new URLSearchParams(search);
  const one = (key: string) => query.getAll(key).length === 1 ? query.get(key)! : "";
  const filters = { ...emptyFilters };
  for (const key of Object.keys(filterChoices) as Array<keyof typeof filterChoices>) if (filterChoices[key].includes(one(key))) filters[key] = one(key);
  for (const role of ["issuer", "verifier"] as const) {
    const candidate = one(`${role}Version`);
    if (versions ? versions[role].includes(candidate) : candidate.length <= 128) filters[`${role}Version`] = candidate;
  }
  const id = (key: string) => isRunId(one(key)) ? one(key) : "";
  return { view: one("view") === "matrix" ? "matrix" : "history", run: id("run"), compareA: id("compareA"), compareB: id("compareB"), filters };
}
export function locationQuery(state: ArchiveLocation, versions: Versions): string {
  const query = new URLSearchParams();
  if (state.view === "matrix") query.set("view", "matrix");
  for (const key of ["run", "compareA", "compareB"] as const) if (isRunId(state[key])) query.set(key, state[key]);
  for (const key of Object.keys(filterChoices) as Array<keyof typeof filterChoices>) if (filterChoices[key].includes(state.filters[key])) query.set(key, state.filters[key]);
  for (const role of ["issuer", "verifier"] as const) if (versions[role].includes(state.filters[`${role}Version`]) && state.filters[`${role}Version`]) query.set(`${role}Version`, state.filters[`${role}Version`]);
  return query.size ? `?${query}` : "";
}
export function useArchiveLocation(versions: Versions, ready: boolean) {
  const [state, setState] = useState(() => parseLocation(window.location.search));
  const current = useRef(state); current.current = state;
  const versionKey = JSON.stringify(versions);
  const registry = useRef(versions); registry.current = versions;
  useEffect(() => {
    const canonicalize = (next: ArchiveLocation) => window.history.replaceState(null, "", window.location.pathname + locationQuery(next, registry.current));
    // Keep initial version candidates in memory until the authorized archive loads.
    const next = ready ? parseLocation(locationQuery(current.current, registry.current), registry.current) : current.current;
    if (ready) { current.current = next; setState(next); }
    canonicalize(next);
    const pop = () => { const next = parseLocation(window.location.search, registry.current); current.current = next; setState(next); canonicalize(next); };
    window.addEventListener("popstate", pop);
    return () => window.removeEventListener("popstate", pop);
  }, [ready, versionKey]);
  const update = useCallback((patch: Partial<ArchiveLocation>) => {
    const candidate = { ...current.current, ...patch };
    const query = locationQuery(candidate, registry.current);
    const next = parseLocation(query, registry.current);
    current.current = next; setState(next);
    const href = window.location.pathname + query;
    if (href !== window.location.pathname + window.location.search || window.location.hash) window.history.pushState(null, "", href);
  }, []);
  return { state, update, href: window.location.pathname + locationQuery(state, versions) };
}
