import type { RunSummary } from "@playground/shared";

// Group by deployment profile and expected outcome so negative controls and
// fixture simulations don't inflate the success rate for a real wallet.
export function flowTelemetry(runs: RunSummary[]) {
  const groups = new Map<string, { profile: string; flow: string; expected: string; completed: number; passed: number; durations: number[] }>();
  for (const run of runs) {
    if (run.recordKind === "archived_evidence" || !["passed","failed","errored"].includes(run.status)) continue;
    const { issuer, wallet, verifier, format, flow } = run.config;
    const route = [issuer, wallet, verifier, format, flow].join(" / ");
    const profile = run.protocolProfile ?? "unreported";
    const key = JSON.stringify([profile, route, run.expectedOutcome]);
    const group = groups.get(key) ?? {profile, flow:route, expected:run.expectedOutcome, completed:0, passed:0, durations:[]};
    group.completed++;
    if (run.status === "passed") group.passed++;
    const latency = Date.parse(run.finishedAt ?? "") - Date.parse(run.startedAt ?? "");
    if (Number.isFinite(latency) && latency >= 0) group.durations.push(latency);
    groups.set(key, group);
  }
  return [...groups.values()].map(({durations, ...group}) => {
    durations.sort((a,b)=>a-b);
    return {...group, successRate:group.passed/group.completed, latencySamples:durations.length,
      p50Ms:durations[Math.ceil(durations.length*0.5)-1]??null, p95Ms:durations[Math.ceil(durations.length*0.95)-1]??null};
  });
}
