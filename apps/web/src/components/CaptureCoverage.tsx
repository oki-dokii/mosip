import { useEffect, useRef, useState } from "react";
import { api } from "../lib/api";
import { coverage, object, serverCoverage, type ServerHop, type Coverage } from "../lib/captureEvidence";
import { ProjectionCounts } from "./PublicEvidence";

export function CaptureCoverage({ runId, onImported, canImport = true, exchangeCount = 0 }: { runId: string; onImported: () => void; canImport?: boolean; exchangeCount?: number }) {
  const [rows, setRows] = useState<Coverage[] | null>(null);
  const [serverHops, setServerHops] = useState<ServerHop[] | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const generation = useRef(0);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => { let stopped = false; const version = ++generation.current; setLoading(true); void api.captureCoverage(runId).then(value => { if (!stopped && version === generation.current) { setRows(coverage(object(value)?.coverage)); setServerHops(serverCoverage(object(value)?.serverHops)); } }).catch(() => { if (!stopped && version === generation.current) { setRows(null); setServerHops(null); } }).finally(() => { if (!stopped && version === generation.current) setLoading(false); }); return () => { stopped = true; }; }, [runId, exchangeCount]);
  async function upload() {
    const file = input.current?.files?.[0];
    if (busy || !canImport) return;
    if (!file) { setMessage("Choose a synthetic capture JSON file first."); return; }
    ++generation.current;
    setBusy(true); setMessage(null);
    try {
      if (file.size > 2_000_000) throw new Error();
      const payload: unknown = JSON.parse(await file.text());
      if (object(payload)?.runId !== runId) throw new Error();
      const response = await api.importCapture(runId, payload);
      const next = coverage(object(response)?.coverage);
      if (!next) throw new Error();
      setRows(next); setServerHops(serverCoverage(object(response)?.serverHops)); setMessage("Synthetic capture imported. This does not establish wallet storage or verification.");
      onImported();
    } catch { setMessage("Capture import unavailable or rejected. Check the run ID, JSON envelope, allowlisted origins and 2 MB limit. No verifier verdict was established."); }
    finally { setBusy(false); setLoading(false); if (input.current) input.current.value = ""; }
  }
  const totals = rows?.reduce((sum, row) => ({ withheldNames: sum.withheldNames + row.projection.withheldNames, truncatedItems: sum.truncatedItems + row.projection.truncatedItems, unsupportedKinds: sum.unsupportedKinds + row.projection.unsupportedKinds }), { withheldNames: 0, truncatedItems: 0, unsupportedKinds: 0 });
  return <section aria-label="Browser capture coverage" className="mb-5 space-y-3 rounded-xl border border-slate-300 bg-slate-50 p-4 text-slate-800">
    <h3 className="font-bold">Browser capture coverage</h3>
    <p className="text-sm">Synthetic test traffic only. Choose a bounded capture envelope prepared by the capture filter. Never upload real-session HAR or account credentials.</p>
    {!canImport && <p className="text-sm">Import becomes available after the run finishes; the current backend rejects capture for active runs.</p>}
    <label className="block text-sm">Synthetic capture JSON <input ref={input} type="file" accept=".json,.har,application/json" disabled={busy || !canImport} /></label>
    <button type="button" disabled={busy || !canImport} onClick={() => void upload()} className="rounded-lg border border-slate-400 bg-white px-3 py-2 font-semibold disabled:opacity-60">{busy ? "Importing…" : "Import synthetic capture"}</button>
    <p role="status">{busy ? "Importing synthetic capture…" : message ?? (loading ? "Loading capture coverage…" : !rows ? "Coverage unavailable: the server coverage response could not be loaded." : "Capture coverage loaded.")}</p>
    {rows && <>
      {totals && <ProjectionCounts totals={totals} />}
      <ul className="space-y-2">{rows.map((row, index) => <li key={index} className={`rounded border p-2 text-sm ${row.state === "captured" ? "border-blue-300 bg-blue-50" : "border-slate-300 bg-white"}`}>
        <strong>{row.stepKey}: {row.state}</strong> · {row.count} exchanges<p>{row.reason}</p><ProjectionCounts totals={row.projection} />
      </li>)}</ul>
    </>}
    <section aria-label="Local server-hop capture coverage" className="space-y-2 border-t border-slate-300 pt-3">
      <h4 className="font-bold">Local server-hop capture</h4>
      <p className="text-sm">Mimoto transport is separate from browser traffic. An observed HTTP exchange does not establish a verifier verdict or wallet storage.</p>
      {serverHops === null ? <p className="text-sm">Server-hop coverage unavailable on this record.</p> : serverHops.length === 0 ? <p className="text-sm">No server-hop records supplied.</p> : <ul className="space-y-2">{serverHops.map(hop => <li key={hop.ruleId} className="rounded border border-slate-300 bg-white p-2 text-sm"><strong>{hop.ruleId}: {hop.state}</strong><p>{hop.actorFrom} → {hop.actorTo} · {hop.exchangeIds.length} saved exchanges</p>{hop.exchangeIds.length > 0 && <details><summary>Saved exchange IDs</summary><ul>{hop.exchangeIds.map(id => <li key={id} className="break-all font-mono text-xs">{id}</li>)}</ul></details>}</li>)}</ul>}
      <p className="text-sm">Request fetch may remain not_observed when a request is passed by value. Storage requires a reload check; verification requires the independent Verify result.</p>
    </section>
    <p className="text-sm">Missing is an observation gap, not a failed verification. Wallet-local storage is not observable through browser HAR.</p>
  </section>;
}
