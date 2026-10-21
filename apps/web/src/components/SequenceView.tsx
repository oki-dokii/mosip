import type { Exchange } from "@playground/shared";
import { ArrowRight, Copy } from "lucide-react";
import { api } from "../lib/api";

interface Props {
  runId: string;
  exchanges: Exchange[];
  selectedStepId: string | null;
  onSelect: (stepId: string) => void;
}

export function SequenceView({ runId, exchanges, selectedStepId, onSelect }: Props) {
  async function copyMermaid() {
    const sequence = await api.sequence(runId);
    await navigator.clipboard.writeText(sequence.mermaid);
  }

  return (
    <section className="mb-6 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
      <div className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3">
        <div><p className="text-xs font-bold uppercase tracking-[0.16em] text-verifier">Sequence</p><p className="text-xs text-slate-500">Select a message to inspect its step.</p></div>
        <button onClick={() => void copyMermaid()} disabled={!exchanges.length} className="flex items-center gap-1.5 rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-bold text-slate-600 disabled:opacity-40"><Copy size={13} />Copy Mermaid</button>
      </div>
      <div className="max-h-72 space-y-2 overflow-y-auto p-3">
        {exchanges.length === 0 ? <p className="py-8 text-center text-sm text-slate-400">Messages appear here as the run progresses.</p> : exchanges.map((exchange) => (
          <button key={exchange.id} onClick={() => onSelect(exchange.stepId)} className={`grid w-full grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 rounded-xl border px-3 py-2 text-left transition ${selectedStepId === exchange.stepId ? "border-blue-300 bg-blue-50 shadow-sm" : "border-slate-200 bg-white hover:border-slate-400"}`}>
            <span className="truncate text-xs font-bold text-slate-700">{exchange.actorFrom}</span>
            <span className="flex items-center gap-1 text-[11px] font-semibold text-slate-500"><span>{exchange.method}</span><ArrowRight size={13} /><span className={exchange.status < 400 ? "text-ok" : "text-fail"}>{exchange.status}</span></span>
            <span className="truncate text-right text-xs font-bold text-slate-700">{exchange.actorTo}</span>
            <span className="col-span-3 truncate font-mono text-[10px] text-slate-400">{exchange.url}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
