import { useMemo, useState } from "react";
import type { RunSummary } from "@playground/shared";
import { evidenceLabels, evidenceTier } from "@playground/shared/evidence";
import { Download } from "lucide-react";

interface Props {
  history: RunSummary[];
  matrix: RunSummary[];
  active: "history" | "matrix";
  onActiveChange: (active: "history" | "matrix") => void;
  onSelectRun: (id: string) => void;
}

function Outcome({ run }: { run: RunSummary }) {
  const success = run.status === "passed";
  return <span className={`rounded-full px-2 py-1 text-[11px] font-bold ${success ? "bg-green-50 text-ok" : run.status === "running" || run.status === "pending" ? "bg-blue-50 text-issuer" : "bg-red-50 text-fail"}`}>{run.status}</span>;
}

export function RunArchive({ history, matrix, active, onActiveChange, onSelectRun }: Props) {
  const [format, setFormat] = useState("");
  const [status, setStatus] = useState("");
  const [issuer, setIssuer] = useState("");
  const [wallet, setWallet] = useState("");
  const [verifier, setVerifier] = useState("");
  const [issuerVersion, setIssuerVersion] = useState("");
  const [verifierVersion, setVerifierVersion] = useState("");
  const versions = useMemo(() => ({
    issuer: [...new Set(history.map((run) => run.serviceVersions?.issuer).filter((value): value is string => Boolean(value)))].sort(),
    verifier: [...new Set(history.map((run) => run.serviceVersions?.verifier).filter((value): value is string => Boolean(value)))].sort(),
  }), [history]);
  const rows = useMemo(() => (active === "history" ? history : matrix).filter((run) =>
    (!format || run.config.format === format) &&
    (!status || run.status === status) &&
    (!issuer || run.config.issuer === issuer) &&
    (!wallet || run.config.wallet === wallet) &&
    (!verifier || run.config.verifier === verifier) &&
    (!issuerVersion || run.serviceVersions?.issuer === issuerVersion) &&
    (!verifierVersion || run.serviceVersions?.verifier === verifierVersion)), [active, history, matrix, format, status, issuer, wallet, verifier, issuerVersion, verifierVersion]);
  const selectClass = "rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-600";
  return (
    <section className="mt-7 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-card">
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 px-6 py-4 lg:px-8">
        <button onClick={() => onActiveChange("history")} className={`rounded-lg px-3 py-2 text-sm font-bold ${active === "history" ? "bg-ink text-white" : "text-slate-500"}`}>Run history</button>
        <button onClick={() => onActiveChange("matrix")} className={`rounded-lg px-3 py-2 text-sm font-bold ${active === "matrix" ? "bg-ink text-white" : "text-slate-500"}`}>Latest matrix</button>
        {active === "matrix" && <div className="ml-auto flex gap-2"><a href="/api/v1/matrix/export?format=csv" className="flex items-center gap-1 rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-bold text-slate-600"><Download size={13} />CSV</a><a href="/api/v1/matrix/export?format=md" className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-bold text-slate-600">Markdown</a></div>}
      </div>
      <div className="flex flex-wrap gap-2 border-b border-slate-100 px-6 py-3 lg:px-8">
        <select aria-label="Filter issuer" className={selectClass} value={issuer} onChange={(event) => setIssuer(event.target.value)}><option value="">All issuers</option><option value="inji_certify">Inji Certify</option><option value="mock_issuer">Mock issuer</option></select>
        <select aria-label="Filter wallet" className={selectClass} value={wallet} onChange={(event) => setWallet(event.target.value)}><option value="">All wallets</option><option value="reference_wallet">Reference Wallet</option><option value="inji_web_assisted">Inji Web</option></select>
        <select aria-label="Filter verifier" className={selectClass} value={verifier} onChange={(event) => setVerifier(event.target.value)}><option value="">All verifiers</option><option value="inji_verify">Inji Verify</option><option value="mock_verifier">Mock verifier</option></select>
        <select aria-label="Filter format" className={selectClass} value={format} onChange={(event) => setFormat(event.target.value)}><option value="">All formats</option><option value="ldp_vc">JSON-LD VC</option><option value="vc_sd_jwt">SD-JWT VC</option></select>
        <select aria-label="Filter status" className={selectClass} value={status} onChange={(event) => setStatus(event.target.value)}><option value="">All outcomes</option><option value="passed">Passed</option><option value="failed">Mismatch</option><option value="errored">Error</option></select>
        <select aria-label="Filter issuer version" className={selectClass} value={issuerVersion} onChange={(event) => setIssuerVersion(event.target.value)}><option value="">All issuer versions</option>{versions.issuer.map((version) => <option key={version} value={version}>{version}</option>)}</select>
        <select aria-label="Filter verifier version" className={selectClass} value={verifierVersion} onChange={(event) => setVerifierVersion(event.target.value)}><option value="">All verifier versions</option>{versions.verifier.map((version) => <option key={version} value={version}>{version}</option>)}</select>
        <span className="ml-auto self-center text-xs text-slate-500">{rows.length} runs</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1050px] text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500"><tr><th className="px-6 py-3">Run</th><th className="px-4 py-3">Journey</th><th className="px-4 py-3">Format</th><th className="px-4 py-3">Versions</th><th className="px-4 py-3">Fault</th><th className="px-4 py-3">Outcome</th><th className="px-4 py-3">Evidence</th><th className="px-6 py-3">Created</th></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((run) => <tr key={run.id} onClick={() => onSelectRun(run.id)} className="cursor-pointer hover:bg-blue-50/50"><td className="px-6 py-3 font-mono text-xs font-bold text-issuer"><button type="button" onClick={(event) => { event.stopPropagation(); onSelectRun(run.id); }} className="underline focus-visible:outline focus-visible:outline-2">Open run {run.id.slice(0, 8)}</button></td><td className="px-4 py-3 text-xs text-slate-600">{run.config.issuer} → {run.config.wallet} → {run.config.verifier}</td><td className="px-4 py-3 font-semibold">{run.config.format}</td><td className="px-4 py-3 text-[11px] text-slate-500">{run.serviceVersions?.issuer ?? "unreported"} / {run.serviceVersions?.verifier ?? "unreported"}</td><td className="px-4 py-3 text-slate-500">{run.config.tamper ?? "none"}</td><td className="px-4 py-3"><Outcome run={run} /></td><td className="px-4 py-3 text-xs text-slate-500">{evidenceLabels[evidenceTier(run)]}</td><td className="px-6 py-3 text-xs text-slate-500">{new Date(run.createdAt).toLocaleString()}</td></tr>)}
            {rows.length === 0 && <tr><td colSpan={8} className="px-6 py-12 text-center text-slate-400">No runs match these filters.</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  );
}
