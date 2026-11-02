import { useReadingPreferences } from "./ReadingPreferences";
import { SupportedMatrix } from "./SupportedMatrix";
import { useMemo } from "react";
import type { RunSummary } from "@playground/shared";
import { evidenceLabels, evidenceTier } from "@playground/shared/evidence";
import { isRunId, versionsFor, type ArchiveLocation, type Filters } from "../lib/archiveLocation";
import { Download } from "lucide-react";

interface Props {
  history: RunSummary[];
  matrix: RunSummary[];
  active: "history" | "matrix";
  onActiveChange: (active: "history" | "matrix") => void;
  onSelectRun: (id: string) => void;
  location: ArchiveLocation;
  onLocationChange: (patch: Partial<ArchiveLocation>) => void;
  shareHref: string;
}

function Outcome({ run }: { run: RunSummary }) {
  const success = run.status === "passed";
  return <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${success ? "bg-emerald-50 text-ok border border-emerald-200" : run.status === "running" || run.status === "pending" ? "bg-blue-50 text-issuer border border-blue-200" : "bg-red-50 text-fail border border-red-200"}`}>{run.status}</span>;
}

export function RunArchive({ history, matrix, active, onActiveChange, onSelectRun, location, onLocationChange, shareHref }: Props) {
  const { t, locale } = useReadingPreferences();
  const { format, status, issuer, wallet, verifier, issuerVersion, verifierVersion } = location.filters;
  const setFilter = (key: keyof Filters, value: string) => onLocationChange({ filters: { ...location.filters, [key]: value } });
  const setFormat = (value: string) => setFilter("format", value);
  const setStatus = (value: string) => setFilter("status", value);
  const setIssuer = (value: string) => setFilter("issuer", value);
  const setWallet = (value: string) => setFilter("wallet", value);
  const setVerifier = (value: string) => setFilter("verifier", value);
  const setIssuerVersion = (value: string) => setFilter("issuerVersion", value);
  const setVerifierVersion = (value: string) => setFilter("verifierVersion", value);
  const versions = useMemo(() => versionsFor([...history, ...matrix]), [history, matrix]);
  const recorded = [...new Map([...history, ...matrix].filter(r => isRunId(r.id)).map(r => [r.id, r])).values()];
  const rows = useMemo(() => (active === "history" ? history : matrix).filter((run) =>
    (!format || run.config.format === format) &&
    (!status || run.status === status) &&
    (!issuer || run.config.issuer === issuer) &&
    (!wallet || run.config.wallet === wallet) &&
    (!verifier || run.config.verifier === verifier) &&
    (!issuerVersion || run.serviceVersions?.issuer === issuerVersion) &&
    (!verifierVersion || run.serviceVersions?.verifier === verifierVersion)), [active, history, matrix, format, status, issuer, wallet, verifier, issuerVersion, verifierVersion]);
  const selectClass = "rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-700 shadow-xs";
  return (
    <section aria-label="Run archive" tabIndex={-1} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 px-5 py-3">
        <button lang={locale} aria-pressed={active === "history"} onClick={() => onActiveChange("history")} className={`rounded-md px-3 py-1.5 text-xs font-bold transition ${active === "history" ? "bg-ink text-white" : "text-slate-500 hover:text-ink"}`}>{t("history")}</button>
        <button lang={locale} aria-pressed={active === "matrix"} onClick={() => onActiveChange("matrix")} className={`rounded-md px-3 py-1.5 text-xs font-bold transition ${active === "matrix" ? "bg-ink text-white" : "text-slate-500 hover:text-ink"}`}>{t("matrix")}</button>
        {active === "matrix" && <div className="ml-auto flex gap-1.5"><a href="/api/v1/matrix/export?format=csv" className="flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-600 shadow-xs hover:bg-slate-50"><Download size={12} />CSV</a><a href="/api/v1/matrix/export?format=md" className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-600 shadow-xs hover:bg-slate-50">Markdown</a></div>}
      </div>
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 bg-slate-50/50 px-5 py-2.5">
        <select aria-label="Filter issuer" className={selectClass} value={issuer} onChange={(event) => setIssuer(event.target.value)}><option value="">All issuers</option><option value="inji_certify">Inji Certify</option><option value="mock_issuer">Mock issuer</option></select>
        <select aria-label="Filter wallet" className={selectClass} value={wallet} onChange={(event) => setWallet(event.target.value)}><option value="">All wallets</option><option value="reference_wallet">Reference Wallet</option><option value="inji_web_assisted">Inji Web</option></select>
        <select aria-label="Filter verifier" className={selectClass} value={verifier} onChange={(event) => setVerifier(event.target.value)}><option value="">All verifiers</option><option value="inji_verify">Inji Verify</option><option value="mock_verifier">Mock verifier</option></select>
        <select aria-label="Filter format" className={selectClass} value={format} onChange={(event) => setFormat(event.target.value)}><option value="">All formats</option><option value="ldp_vc">JSON-LD VC</option><option value="vc_sd_jwt">SD-JWT VC</option></select>
        <select aria-label="Filter status" className={selectClass} value={status} onChange={(event) => setStatus(event.target.value)}><option value="">All outcomes</option><option value="passed">Passed</option><option value="failed">Mismatch</option><option value="errored">Error</option><option value="pending">Pending</option><option value="running">Running</option><option value="cancelled">Cancelled</option></select>
        <select aria-label="Filter issuer version" className={selectClass} value={issuerVersion} onChange={(event) => setIssuerVersion(event.target.value)}><option value="">All issuer versions</option>{versions.issuer.map((version) => <option key={version} value={version}>{version}</option>)}</select>
        <select aria-label="Filter verifier version" className={selectClass} value={verifierVersion} onChange={(event) => setVerifierVersion(event.target.value)}><option value="">All verifier versions</option>{versions.verifier.map((version) => <option key={version} value={version}>{version}</option>)}</select>
        <span role="status" className="ml-auto self-center text-xs text-slate-500 font-medium">{rows.length} runs</span>
      </div>
      <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 px-5 py-2.5 text-xs text-slate-600">
        {(["compareA", "compareB"] as const).map((key, i) => <label key={key} className="flex items-center gap-1.5 font-medium">Run {i === 0 ? "A" : "B"} <select aria-label={`Compare run ${i === 0 ? "A" : "B"}`} className={selectClass} value={location[key]} onChange={event => onLocationChange({ [key]: event.target.value })}><option value="">Select recorded run</option>{location[key] && !recorded.some(r => r.id === location[key]) && <option value={location[key]}>Linked run {location[key].slice(0, 8)}</option>}{recorded.map(r => <option key={r.id} value={r.id}>{r.id.slice(0, 8)} · {r.config.wallet} · {r.config.format} · {r.status}</option>)}</select></label>)}
        <a className="ml-auto font-semibold text-issuer hover:underline" href={shareHref}>Share this view</a>
      </div>
      {active === "matrix" && <SupportedMatrix />}
      <div role="region" aria-label="Recorded runs table" tabIndex={0} className="overflow-x-auto">
        <table className="w-full min-w-[1050px] text-left text-xs">
          <caption className="sr-only">Recorded runs · {active === "history" ? "history" : "latest matrix"}</caption><thead className="bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-500 border-b border-slate-200"><tr><th scope="col" className="px-5 py-2.5">Run</th><th scope="col" className="px-4 py-2.5">Journey</th><th scope="col" className="px-4 py-2.5">Format</th><th scope="col" className="px-4 py-2.5">Versions</th><th scope="col" className="px-4 py-2.5">Fault</th><th scope="col" className="px-4 py-2.5">Outcome</th><th scope="col" className="px-4 py-2.5">Evidence</th><th scope="col" className="px-5 py-2.5">Created</th></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((run) => <tr key={run.id} onClick={() => onSelectRun(run.id)} className="cursor-pointer hover:bg-blue-50/50 transition"><td className="px-5 py-2.5 font-mono text-xs font-bold text-issuer"><button type="button" data-open-run={run.id} onClick={(event) => { event.stopPropagation(); onSelectRun(run.id); }} className="hover:underline focus-visible:outline focus-visible:outline-2">Open run {run.id.slice(0, 8)}</button></td><td className="px-4 py-2.5 text-xs text-slate-600 font-mono">{run.config.issuer} → {run.config.wallet} → {run.config.verifier}</td><td className="px-4 py-2.5 font-semibold text-slate-700">{run.config.format}</td><td className="px-4 py-2.5 text-[11px] text-slate-500 font-mono">{run.serviceVersions?.issuer ?? "unreported"} / {run.serviceVersions?.verifier ?? "unreported"}</td><td className="px-4 py-2.5 text-slate-500">{run.config.tamper ?? "none"}</td><td className="px-4 py-2.5"><Outcome run={run} /></td><td className="px-4 py-2.5 text-xs text-slate-500">{run.recordKind === "archived_evidence" && <strong className="block text-blue-800">Archived real-wallet evidence</strong>}{evidenceLabels[evidenceTier(run)]}</td><td className="px-5 py-2.5 text-xs text-slate-500">{new Date(run.createdAt).toLocaleString()}</td></tr>)}
            {rows.length === 0 && <tr><td colSpan={8} className="px-6 py-8 text-center text-xs text-slate-500">No runs match these filters.</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  );
}
