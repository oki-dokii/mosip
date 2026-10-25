import { useEffect, useState } from "react";

interface WalletEvidence {
  id: string; recordKind: "manual_wallet_observation"; wallet: "inji_web" | "inji_mobile"; walletLabel: string;
  format: string; credential: string; observedDate: string; deployment: string; outcome: "valid";
  outcomeSource: "verifier_ui" | "correlated_verifier_response"; managedRunId: string | null; managedValidation: "pending" | "passed";
  reviewStatus: string; versions: { issuer: string; wallet: string; verifier: string };
  checkpoints: { name: string; evidence: string; detail: string }[]; limitations: string[]; artifacts: { label: string; url: string }[];
}
export function WalletEvidencePanel({ onOpenManagedRun, archivedRunIds = [] }: { onOpenManagedRun?: (id: string) => void; archivedRunIds?: string[] }) {
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
  return <section aria-labelledby="wallet-evidence-title" className="mt-7 rounded-3xl border border-slate-200 bg-white p-6 shadow-card lg:p-8">
    <h2 id="wallet-evidence-title" className="text-xl font-bold">Observed real-wallet compatibility</h2>
    <p className="mt-2 text-sm text-slate-600">Recorded journeys apply to the named credential and deployment. Linked managed reports provide separate run evidence; manual observations do not change other run results.</p>
    {error ? <p role="alert" className="mt-4">Real-wallet evidence is unavailable. No compatibility conclusion can be drawn.</p> : !items ? <p role="status">Loading real-wallet evidence…</p> : <>
      <div className="my-4 flex flex-wrap items-center gap-3 text-sm">
        <label>Wallet evidence <select className="rounded border border-slate-300 p-2" value={wallet} onChange={event => setWallet(event.target.value)}><option value="">All real wallets</option><option value="inji_web">Inji Web</option><option value="inji_mobile">Inji Wallet Android</option></select></label>
        {(["json", "md", "csv"] as const).map(format => <a key={format} className="font-semibold text-issuer underline" href={`/api/v1/wallet-evidence/report?format=${format}`}>Evidence report · {format === "md" ? "Markdown" : format.toUpperCase()}</a>)}
      </div>
      {items.length === 0 && <p>No recorded real-wallet observations are available.</p>}
      <div className="grid gap-4 lg:grid-cols-2">{items.filter(item => !wallet || item.wallet === wallet).map(item => <article id={`wallet-evidence-${item.id}`} key={item.id} className="rounded-xl border border-slate-200 p-4">
        <h3 className="font-bold">{item.walletLabel} · {item.format === "ldp_vc" ? "JSON-LD" : "SD-JWT"}</h3>
        <p className="mt-2 font-semibold text-green-800">Observed outcome: Valid · {item.outcomeSource === "verifier_ui" ? "verifier UI" : "correlated verifier response"}</p>
        <p className="mt-1 text-sm">{item.credential} · observed {item.observedDate}</p>
        <p className="mt-2 text-sm">Manual wallet observation · Managed run: {item.managedRunId ?? "none"} · Managed validation: {item.managedValidation ?? "pending"}</p>
        <p className="text-sm">{item.reviewStatus === "pending_integrator_review" ? "A1 integrator review pending" : "A2 manual acceptance recorded"}</p>
        <p className="mt-2 text-sm text-slate-600">{item.deployment}</p>
        <p className="mt-1 text-xs text-slate-600">Versions (issuer / wallet / verifier): {item.versions.issuer} / {item.versions.wallet} / {item.versions.verifier}</p>
        <ul className="mt-3 space-y-2 text-sm">{item.checkpoints.map(check => <li key={check.name}><strong>{check.name} · {check.evidence === "user_confirmed" ? "user confirmed" : "observed"}:</strong> {check.detail}</li>)}</ul>
        <h4 className="mt-4 font-semibold">Evidence limits</h4><ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-slate-600">{item.limitations.map(limit => <li key={limit}>{limit}</li>)}</ul>
        <div className="mt-4 flex flex-wrap gap-3 text-sm">{item.managedRunId && archivedRunIds.includes(item.managedRunId) && onOpenManagedRun && <button type="button" onClick={() => onOpenManagedRun(item.managedRunId!)} className="font-semibold text-issuer underline">Explore managed run in playground</button>}{item.artifacts.map(artifact => <a key={artifact.url} href={artifact.url} target="_blank" rel="noreferrer" className="font-semibold text-issuer underline">{artifact.label}</a>)}</div>
      </article>)}</div>
    </>}
  </section>;
}
