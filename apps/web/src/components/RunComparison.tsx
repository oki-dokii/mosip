import { useEffect, useState } from "react";
import type { Exchange, RunStep, RunSummary } from "@playground/shared";
import { evidenceLabels, evidenceTier } from "@playground/shared/evidence";
import { useFocusRecovery } from "../lib/useFocusRecovery";
import { api } from "../lib/api";
import { isRunId } from "../lib/archiveLocation";
import { PublicEvidence } from "./PublicEvidence";
import { publicStructure } from "../lib/publicStructure";

interface Recorded { run: RunSummary; steps: RunStep[]; exchanges: Exchange[] }
async function load(id: string): Promise<Recorded> {
  const [run, steps, exchanges] = await Promise.all([api.run(id), api.steps(id), api.exchanges(id)]);
  if (run.id !== id) throw new Error("Run mismatch");
  return { run, steps: steps.items.filter(s => s.runId === id), exchanges: exchanges.items.filter(e => e.runId === id) };
}
function origins(exchanges: Exchange[]) {
  const observed = new Set<string>();
  for (const e of exchanges) {
    try {
      const url = new URL(e.url);
      if (["http:", "https:"].includes(url.protocol)) observed.add(["127.0.0.1", "localhost", "[::1]"].includes(url.hostname) ? "Loopback HTTP observations" : "Remote HTTP observations");
    } catch { /* Missing URL is not evidence of a deployment. */ }
  }
  return [...observed].join("; ") || "Unavailable: no HTTP origins recorded";
}
const text = (value: string | null | undefined) => value ?? "unreported";
export function RunComparison({ a, b }: { a: string; b: string }) {
  const focus = useFocusRecovery();
  const [result, setResult] = useState<{ key: string; records: [Recorded, Recorded] } | null>(null);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const key = `${a}/${b}`;
  useEffect(() => {
    let disposed = false;
    setError("");
    if (isRunId(a) && isRunId(b) && a !== b) void Promise.all([load(a), load(b)]).then(records => {
      if (!disposed) setResult({ key, records });
    }).catch(() => { if (!disposed) setError("Comparison unavailable. A run may be missing or you may not have access. Try again with your existing authorized session."); });
    return () => { disposed = true; };
  }, [a, b, key, retry]);
  const records = result?.key === key ? result.records : null;
  const fields: Array<[string, (r: Recorded) => string]> = [
    ["Run ID", r => r.run.id],
    ["Configuration", r => `${r.run.config.issuer} → ${r.run.config.wallet} → ${r.run.config.verifier}`],
    ["Format / flow / fault", r => `${r.run.config.format} / ${r.run.config.flow} / ${r.run.config.tamper ?? "none"}`],
    ["Scenario", r => r.run.config.scenarioId ?? "none"],
    ["Protocol profile", r => text(r.run.protocolProfile)],
    ["Issuer version", r => text(r.run.serviceVersions?.issuer)],
    ["Wallet version", r => text(r.run.serviceVersions?.wallet)],
    ["Verifier version", r => text(r.run.serviceVersions?.verifier)],
    ["Proof / algorithm", r => `${r.run.proofType} / ${r.run.algorithm}`],
    ["Record provenance", r => `${r.run.recordKind === "archived_evidence" ? "Archived evidence" : "Managed run"}; ${evidenceLabels[evidenceTier(r.run)]}`],
    ["Observed location", r => origins(r.exchanges)],
    ["Run status", r => r.run.status],
    ["Expected verifier verdict", r => r.run.expectedOutcome],
    ["Recorded verifier verdict", r => r.run.actualOutcome ?? "Unavailable: no normalized result recorded"],
  ];
  return <section ref={focus.root} aria-label="Run comparison" className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 text-xs shadow-sm">
    <h2 ref={focus.fallback} tabIndex={-1} className="text-base font-bold tracking-tight">Compare recorded runs</h2>
    <p className="text-slate-500">Read-only comparison of existing records. Projected metadata does not verify a credential. Links use the current session’s existing access controls.</p>
    <p className="text-slate-500">Fixture, mock and Reference Wallet evidence retain their recorded classifications. Hosted Web, local Web and Android must not be inferred from wallet names or loopback observations. Unreported deployment provenance remains unavailable; not-tested entries have no recorded run to compare.</p>
    <p role="status" className="sr-only">{!a || !b ? "Comparison selection incomplete." : a === b ? "Comparison requires distinct runs." : error ? "Comparison unavailable." : !records ? "Loading comparison…" : "Comparison ready."}</p>
    {!a || !b ? <p className="text-slate-400">Select two recorded runs to compare.</p> : a === b ? <p className="text-amber-700">Select two different runs.</p> : error ? <div role="alert" className="text-red-700">{error} <button onClick={() => setRetry(n => n + 1)} className="underline">Retry comparison</button></div> : !records ? <p>Loading comparison…</p> : <>
      <p className="rounded-lg bg-amber-50 p-2.5 text-xs text-amber-800 border border-amber-200">Profile and version differences are shown below. Different formats, profiles, service versions or evidence sources can make results incomparable; missing versions prevent an equivalence claim. Differences are not automatically regressions.</p>
      <div role="region" aria-label="Run configuration comparison table" tabIndex={0} className="overflow-x-auto"><table className="w-full min-w-[36rem] text-left"><caption className="sr-only">Configuration, provenance and verifier comparison</caption><thead><tr><th scope="col">Field</th><th scope="col">Run A</th><th scope="col">Run B</th></tr></thead><tbody>{fields.map(([label, read]) => {
        const left = read(records[0]), right = read(records[1]);
        return <tr key={label} className={left === right ? "" : "bg-amber-50"}><th scope="row" className="p-2">{label}{left !== right && <span className="sr-only"> (different)</span>}</th><td className="break-all p-2">{left}</td><td className="break-all p-2">{right}</td></tr>;
      })}</tbody></table></div>
      <h3 className="font-bold">Step outcomes</h3>
      <div role="region" aria-label="Run step comparison table" tabIndex={0} className="overflow-x-auto"><table className="w-full min-w-[36rem] text-left"><thead><tr><th scope="col">Step key</th><th scope="col">Run A</th><th scope="col">Run B</th></tr></thead><tbody>{[...new Set(records.flatMap(r => r.steps.map(s => s.stepKey)))].map(step => <tr key={step}><th scope="row">{step}</th>{records.map((r, i) => <td key={i}>{r.steps.filter(s => s.stepKey === step).map(s => s.status).join(", ") || "Unavailable: step not recorded"}</td>)}</tr>)}</tbody></table></div>
      {!records.some(r => r.steps.length) && <p>No steps recorded.</p>}
      <div className="grid gap-4 md:grid-cols-2">{records.map((r, i) => <section key={i} aria-label={`Run ${i === 0 ? "A" : "B"} sanitized structure`}>
        <h3 className="font-bold">Run {i === 0 ? "A" : "B"} available sanitized structure</h3>
        {!r.exchanges.some(e => publicStructure(e.request) || publicStructure(e.response)) && <p>Unavailable: no supported publicView recorded. Raw payloads are never decoded.</p>}
        {r.exchanges.flatMap(e => ([{ value: e.request, side: "request" }, { value: e.response, side: "response" }]).filter(p => publicStructure(p.value)).map(p => <div className="my-3 rounded bg-slate-800 p-3 text-white" key={`${e.id}-${p.side}`}><p>Exchange {e.seq} · {p.side}</p><PublicEvidence value={p.value} label={`Run ${i === 0 ? "A" : "B"} exchange ${e.seq} ${p.side}`} /></div>))}
      </section>)}</div>
    </>}
  </section>;
}
