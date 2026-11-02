import type { Exchange } from "@playground/shared";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, Copy, Pause, Play } from "lucide-react";
import { api } from "../lib/api";

interface Props {
  runId: string;
  exchanges: Exchange[];
  selectedExchangeId: string | null;
  onSelect: (exchange: Exchange) => void;
}

export function SequenceView({ runId, exchanges, selectedExchangeId, onSelect }: Props) {
  const [playing, setPlaying] = useState(false);
  const [visibleCount, setVisibleCount] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const exchangesRef = useRef(exchanges);
  exchangesRef.current = exchanges;

  useEffect(() => {
    if (!playing) return;
    const timer = window.setTimeout(() => {
      const currentExchanges = exchangesRef.current;
      const next = Math.min((visibleCount ?? 0) + 1, currentExchanges.length);
      setVisibleCount(next);
      const exchange = currentExchanges[next - 1];
      if (exchange) onSelect(exchange);
      if (next >= currentExchanges.length) setPlaying(false);
    }, 800);
    return () => window.clearTimeout(timer);
  }, [playing, visibleCount, onSelect]);

  useEffect(() => { setPlaying(false); setVisibleCount(null); setMessage(""); }, [runId]);

  function togglePlayback() {
    if (playing) { setPlaying(false); return; }
    if (visibleCount === null || visibleCount >= exchanges.length) setVisibleCount(0);
    setPlaying(true);
  }

  async function copyMermaid() {
    try {
      const sequence = await api.sequence(runId);
      await navigator.clipboard.writeText(sequence.mermaid);
      setMessage("Mermaid source copied.");
    } catch { setMessage("Copy unavailable. Please try again or download the run report."); }
  }

  return (
    <section className="mb-4 overflow-hidden rounded-xl border border-slate-200 bg-slate-50 shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-white px-4 py-2.5">
        <div><p className="text-xs font-semibold uppercase tracking-wider text-verifier">Sequence</p><p className="text-xs text-slate-600">Select a message to inspect its step.</p></div>
        <div className="flex gap-1.5"><button onClick={togglePlayback} disabled={!exchanges.length} className="flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50 disabled:opacity-40">{playing ? <Pause size={12} /> : <Play size={12} />}{playing ? "Pause" : "Play"}</button><button onClick={() => void copyMermaid()} disabled={!exchanges.length} className="flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50 disabled:opacity-40"><Copy size={12} />Copy Mermaid</button></div>
      </div>
      {message && <p role="status" className="px-3 pt-2 text-xs text-issuer font-medium">{message}</p>}
      <div role="region" aria-label="Protocol messages" tabIndex={0} className="max-h-60 space-y-1.5 overflow-y-auto p-2.5">
        {exchanges.length === 0 ? <p className="py-6 text-center text-xs text-slate-600">Messages appear here as the run progresses.</p> : exchanges.slice(0, visibleCount ?? exchanges.length).map((exchange) => (
          <button key={exchange.id} aria-pressed={selectedExchangeId === exchange.id} onClick={() => { setPlaying(false); setVisibleCount(null); onSelect(exchange); }} className={`grid w-full grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 rounded-lg border px-3 py-1.5 text-left transition ${selectedExchangeId === exchange.id ? "border-blue-300 bg-blue-50 shadow-sm" : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"}`}>
            <span className="truncate font-mono text-xs font-bold text-slate-800">{exchange.actorFrom}</span>
            <span className="flex items-center gap-1 text-xs font-semibold text-slate-700"><span className="rounded bg-slate-100 px-1 py-0.5 text-[10px] font-mono uppercase">{exchange.method}</span><ArrowRight size={11} /><span className={exchange.status < 400 ? "text-ok font-mono" : "text-fail font-mono"}>{exchange.status}</span></span>
            <span className="truncate text-right font-mono text-xs font-bold text-slate-800">{exchange.actorTo}</span>
            <span className="col-span-3 truncate font-mono text-xs text-slate-600">{exchange.url}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
