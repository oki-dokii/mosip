import type { Exchange, ImplementationMetadata, RunConfig, RunStep, RunSummary, ScenarioDefinition } from "@playground/shared";

async function json<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, init);
  if (!response.ok) throw new Error(`Request failed with ${response.status}`);
  return response.json() as Promise<T>;
}

export const api = {
  assistedCapabilities: () => json<{ liveAvailable: boolean }>("/api/v1/assisted/capabilities"),
  startAssisted: (config: RunConfig, mode: "fixture" | "live") => json<{ runId: string }>("/api/v1/assisted/runs", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ config, mode }) }),
  assistedStatus: (id: string) => json<{ run: RunSummary; steps: RunStep[]; actions: Record<string, string>; deadlineAt: number | null }>(`/api/v1/assisted/runs/${id}`),
  assistedObserve: (id: string, kind: "issuance" | "storage" | "presentation") => json(`/api/v1/assisted/runs/${id}/observations`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ kind }) }),
  cancelAssisted: (id: string) => json(`/api/v1/assisted/runs/${id}/cancel`, { method: "POST" }),
  captureCoverage: (id: string) => json<unknown>(`/api/v1/runs/${id}/capture/coverage`),
  importCapture: (id: string, payload: unknown) => json<unknown>(`/api/v1/runs/${encodeURIComponent(id)}/capture/har`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) }),
  metadata: () => json<ImplementationMetadata>("/api/v1/meta/implementations"),
  scenarios: () => json<{ items: ScenarioDefinition[] }>("/api/v1/scenarios"),
  health: () => json<{ driverMode: "fixture" | "collab"; storage: "memory" | "postgres" }>("/api/v1/health"),
  runs: (filters?: Record<string, string>) => json<{ items: RunSummary[] }>(`/api/v1/runs${filters ? `?${new URLSearchParams(filters)}` : ""}`),
  matrix: () => json<{ items: RunSummary[] }>("/api/v1/matrix"),
  createRun: (config: RunConfig) => json<{ runId: string }>("/api/v1/runs", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(config),
  }),
  replayRun: (id: string, tamper: RunConfig["tamper"]) => json<{ runId: string }>(`/api/v1/runs/${id}/replay`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ tamper }),
  }),
  run: (id: string) => json<RunSummary>(`/api/v1/runs/${id}`),
  steps: (id: string) => json<{ items: RunStep[] }>(`/api/v1/runs/${id}/steps`),
  exchanges: (id: string) => json<{ items: Exchange[] }>(`/api/v1/runs/${id}/exchanges`),
  sequence: (id: string) => json<{ mermaid: string; markers: Array<{ exchangeId: string; stepId: string; line: number }> }>(`/api/v1/runs/${id}/sequence`),
};
