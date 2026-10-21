import type { Exchange, ImplementationMetadata, RunConfig, RunStep, RunSummary } from "@playground/shared";

async function json<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, init);
  if (!response.ok) throw new Error(`Request failed with ${response.status}`);
  return response.json() as Promise<T>;
}

export const api = {
  metadata: () => json<ImplementationMetadata>("/api/v1/meta/implementations"),
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
