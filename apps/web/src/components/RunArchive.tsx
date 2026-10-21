import type { RunSummary } from "@playground/shared";
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
  const rows = active === "history" ? history : matrix;
  return (
    <section className="mt-7 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-card">
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 px-6 py-4 lg:px-8">
        <button onClick={() => onActiveChange("history")} className={`rounded-lg px-3 py-2 text-sm font-bold ${active === "history" ? "bg-ink text-white" : "text-slate-500"}`}>Run history</button>
        <button onClick={() => onActiveChange("matrix")} className={`rounded-lg px-3 py-2 text-sm font-bold ${active === "matrix" ? "bg-ink text-white" : "text-slate-500"}`}>Latest matrix</button>
        {active === "matrix" && <div className="ml-auto flex gap-2"><a href="/api/v1/matrix/export?format=csv" className="flex items-center gap-1 rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-bold text-slate-600"><Download size={13} />CSV</a><a href="/api/v1/matrix/export?format=md" className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-bold text-slate-600">Markdown</a></div>}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[850px] text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500"><tr><th className="px-6 py-3">Run</th><th className="px-4 py-3">Journey</th><th className="px-4 py-3">Format</th><th className="px-4 py-3">Fault</th><th className="px-4 py-3">Outcome</th><th className="px-6 py-3">Created</th></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((run) => <tr key={run.id} onClick={() => onSelectRun(run.id)} className="cursor-pointer hover:bg-blue-50/50"><td className="px-6 py-3 font-mono text-xs font-bold text-issuer">{run.id.slice(0, 8)}</td><td className="px-4 py-3 text-xs text-slate-600">{run.config.issuer} → {run.config.wallet} → {run.config.verifier}</td><td className="px-4 py-3 font-semibold">{run.config.format}</td><td className="px-4 py-3 text-slate-500">{run.config.tamper ?? "none"}</td><td className="px-4 py-3"><Outcome run={run} /></td><td className="px-6 py-3 text-xs text-slate-500">{new Date(run.createdAt).toLocaleString()}</td></tr>)}
            {rows.length === 0 && <tr><td colSpan={6} className="px-6 py-12 text-center text-slate-400">No completed runs yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  );
}
