import { useEffect, useState } from "react";

interface WalletEvidence {
  id: string; recordKind: "manual_wallet_observation"; wallet: "inji_web" | "inji_mobile"; walletLabel: string;
  format: string; credential: string; observedDate: string; deployment: string; outcome: "valid";
  outcomeSource: "verifier_ui" | "correlated_verifier_response"; managedRunId: string | null; managedValidation: "pending" | "passed";
  reviewStatus: string; versions: { issuer: string; wallet: string; verifier: string };
  checkpoints: { name: string; evidence: string; detail: string }[]; limitations: string[]; artifacts: { label: string; url: string }[];
}
export function WalletEvidencePanel({ onOpenManagedRun, archivedRunIds = [], mobileOnly = false }: { mobileOnly?: boolean; onOpenManagedRun?: (id: string) => void; archivedRunIds?: string[] }) {
  const [items, setItems] = useState<WalletEvidence[] | null>(null);
  const [error, setError] = useState(false);
  const [wallet, setWallet] = useState("");
  useEffect(() => {
    const abort = new AbortController();
    void fetch("/api/v1/wallet-evidence", { signal: abort.signal }).then(async response => {
      if (!response.ok) throw new Error();
      const body = await response.json();
      if (body.schemaVersion !== 1 || !Array.isArray(body.items)) throw new Error();
      if (!abort.signal.aborted) setItems(body.items);
    }).catch(() => { if (!abort.signal.aborted) setError(true); });
    return () => abort.abort();
  }, []);
  const visibleItems = items?.filter(item => mobileOnly ? item.wallet === "inji_mobile" : !wallet || item.wallet === wallet);
  return <section aria-labelledby="wallet-evidence-title" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
    <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-200">
      <div>
        <h2 id="wallet-evidence-title" className="text-base font-bold tracking-tight">{mobileOnly ? "Recorded Android journeys" : "Observed real-wallet compatibility"}</h2>
        <p className="mt-0.5 text-xs text-slate-600">Recorded journeys apply to the named credential and deployment. Linked managed reports provide separate run evidence; manual observations do not change other run results.</p>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-xs">
        {!mobileOnly && <label className="font-semibold text-slate-700">Wallet evidence <select className="rounded border border-slate-300 bg-white p-2 text-slate-700" value={wallet} onChange={event => setWallet(event.target.value)}><option value="">All real wallets</option><option value="inji_web">Inji Web</option><option value="inji_mobile">Inji Wallet Android</option></select></label>}
        {(["json", "md", "csv"] as const).map(format => <a key={format} className="font-semibold text-issuer hover:underline" href={`/api/v1/wallet-evidence/report?format=${format}`}>Evidence report · {format === "md" ? "Markdown" : format.toUpperCase()}</a>)}
      </div>
    </div>
    {error ? <p role="alert" className="mt-4 text-xs text-red-700">Real-wallet evidence is unavailable. No compatibility conclusion can be drawn.</p> : !items ? <p role="status" className="mt-4 text-xs text-slate-600">Loading real-wallet evidence…</p> : <>
      {visibleItems?.length === 0 && <p className="mt-4 text-xs text-slate-600">No recorded real-wallet observations are available.</p>}
      <div className="mt-4 grid gap-4 lg:grid-cols-2">{visibleItems?.map(item => <article id={`wallet-evidence-${item.id}`} key={item.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-bold text-slate-900">{item.walletLabel} · {item.format === "ldp_vc" ? "JSON-LD" : "SD-JWT"}</h3>
          <span className="rounded-full bg-green-50 px-2.5 py-0.5 text-xs font-semibold text-green-800 border border-green-200">Observed outcome: {item.outcome === "valid" ? "Valid" : item.outcome ?? "Unreported"} · {item.outcomeSource === "verifier_ui" ? "verifier UI" : "correlated verifier response"}</span>
        </div>
        <div className="text-xs text-slate-700 space-y-0.5">
          <p className="font-semibold text-slate-900">{item.credential} · observed {item.observedDate}</p>
          <p>Manual wallet observation · Managed run: {item.managedRunId ?? "none"} · Managed validation: {item.managedValidation ?? "pending"}</p>
          <p className="font-semibold text-slate-800">{item.reviewStatus === "pending_integrator_review" ? "A1 integrator review pending" : "A2 manual acceptance recorded"}</p>
          <p className="text-slate-600">{item.deployment}</p>
          <p className="text-xs text-slate-600">Versions (issuer / wallet / verifier): {item.versions.issuer} / {item.versions.wallet} / {item.versions.verifier}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-2.5">
          <ul className="space-y-1.5 text-xs text-slate-800">{item.checkpoints.map(check => <li key={check.name}><strong>{check.name} · {check.evidence === "user_confirmed" ? "user confirmed" : "observed"}:</strong> <span className="text-slate-700">{check.detail}</span></li>)}</ul>
        </div>
        <div className="pt-1">
          <h4 className="text-xs font-bold text-slate-800">Evidence limits</h4>
          <ul className="mt-1 list-disc space-y-0.5 pl-4 text-xs text-slate-600">{item.limitations.map(limit => <li key={limit}>{limit}</li>)}</ul>
        </div>
        <div className="flex flex-wrap gap-2.5 pt-2 text-xs border-t border-slate-200">{item.managedRunId && archivedRunIds.includes(item.managedRunId) && onOpenManagedRun && <button type="button" onClick={() => onOpenManagedRun(item.managedRunId!)} className="font-semibold text-issuer hover:underline">Explore managed run in playground</button>}{item.artifacts.map(artifact => <a key={artifact.url} href={artifact.url} target="_blank" rel="noreferrer" className="font-semibold text-issuer hover:underline">{artifact.label}</a>)}</div>
      </article>)}</div>
    </>}
  </section>;
}
