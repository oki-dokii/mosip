import type { Exchange, ImplementationMetadata, RunConfig, RunStep, RunSummary } from "@playground/shared";

async function json<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, init);
  if (!response.ok) throw new Error(`Request failed with ${response.status}`);
  return response.json() as Promise<T>;
}

export const api = {
  metadata: () => json<ImplementationMetadata>("/api/v1/meta/implementations"),
  createRun: (config: RunConfig) => json<{ runId: string }>("/api/v1/runs", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(config),
  }),
  run: (id: string) => json<RunSummary>(`/api/v1/runs/${id}`),
  steps: (id: string) => json<{ items: RunStep[] }>(`/api/v1/runs/${id}/steps`),
  exchanges: (id: string) => json<{ items: Exchange[] }>(`/api/v1/runs/${id}/exchanges`),
};
