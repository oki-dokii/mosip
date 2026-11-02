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
  return <section aria-label="Browser capture coverage" className="mb-4 space-y-2.5 rounded-xl border border-slate-200 bg-slate-50/60 p-3.5 text-slate-800 text-xs">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div>
        <h3 className="text-sm font-bold tracking-tight">Browser capture coverage</h3>
        <p className="text-xs text-slate-500">Synthetic test traffic only. Never upload real-session HAR or account credentials.</p>
      </div>
      <p role="status" className="text-xs font-medium text-slate-600">{busy ? "Importing synthetic capture…" : message ?? (loading ? "Loading capture coverage…" : !rows ? "Coverage unavailable: the server coverage response could not be loaded." : "Capture coverage loaded.")}</p>
    </div>
    {!canImport && <p className="text-xs text-amber-700">Import becomes available after the run finishes; the current backend rejects capture for active runs.</p>}
    <div className="flex flex-wrap items-center gap-2 pt-1">
      <label className="text-xs font-medium text-slate-700">Synthetic capture JSON <input ref={input} type="file" accept=".json,.har,application/json" disabled={busy || !canImport} className="ml-1 text-xs file:mr-2 file:rounded-md file:border-0 file:bg-white file:px-2.5 file:py-1 file:text-xs file:font-semibold file:text-slate-700 file:shadow-sm hover:file:bg-slate-100" /></label>
      <button type="button" disabled={busy || !canImport} onClick={() => void upload()} className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50">{busy ? "Importing…" : "Import synthetic capture"}</button>
    </div>
    {rows && <>
      {totals && <div className="text-xs text-slate-500 font-medium"><ProjectionCounts totals={totals} /></div>}
      <ul className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">{rows.map((row, index) => <li key={index} className={`rounded-lg border p-2 text-xs transition ${row.state === "captured" ? "border-blue-300 bg-blue-50/70" : "border-slate-200 bg-white"}`}>
        <div className="font-semibold text-slate-800"><strong>{row.stepKey}: {row.state}</strong> <span className="font-normal text-slate-500">· {row.count} exchanges</span></div>
        <p className="mt-0.5 text-[11px] leading-tight text-slate-500">{row.reason}</p>
        <div className="mt-1 text-[11px] text-slate-400"><ProjectionCounts totals={row.projection} /></div>
      </li>)}</ul>
    </>}
    <section aria-label="Local server-hop capture coverage" className="space-y-1.5 border-t border-slate-200/80 pt-2.5">
      <h4 className="text-xs font-bold text-slate-700">Local server-hop capture</h4>
      <p className="text-[11px] text-slate-500">Mimoto transport is separate from browser traffic. An observed HTTP exchange does not establish a verifier verdict or wallet storage.</p>
      {serverHops === null ? <p className="text-xs text-slate-500">Server-hop coverage unavailable on this record.</p> : serverHops.length === 0 ? <p className="text-xs text-slate-500">No server-hop records supplied.</p> : <ul className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">{serverHops.map(hop => <li key={hop.ruleId} className="rounded-lg border border-slate-200 bg-white p-2 text-xs"><strong>{hop.ruleId}: {hop.state}</strong><p className="mt-0.5 text-[11px] text-slate-500">{hop.actorFrom} → {hop.actorTo} · {hop.exchangeIds.length} saved exchanges</p>{hop.exchangeIds.length > 0 && <details className="mt-1"><summary className="cursor-pointer text-[11px] font-semibold text-issuer">Saved exchange IDs</summary><ul className="mt-1 space-y-0.5">{hop.exchangeIds.map(id => <li key={id} className="break-all font-mono text-[10px] text-slate-600">{id}</li>)}</ul></details>}</li>)}</ul>}
      <p className="text-[11px] text-slate-400">Request fetch may remain not_observed when a request is passed by value. Storage requires a reload check; verification requires the independent Verify result.</p>
    </section>
    <p className="text-[11px] text-slate-400">Missing is an observation gap, not a failed verification. Wallet-local storage is not observable through browser HAR.</p>
  </section>;
}
