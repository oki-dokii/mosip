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
    <section className="mb-6 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3">
        <div><p className="text-xs font-bold uppercase tracking-[0.16em] text-verifier">Sequence</p><p className="text-xs text-slate-600">Select a message to inspect its step.</p></div>
        <div className="flex gap-2"><button onClick={togglePlayback} disabled={!exchanges.length} className="flex items-center gap-1.5 rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-bold text-slate-600 disabled:opacity-40">{playing ? <Pause size={13} /> : <Play size={13} />}{playing ? "Pause" : "Play"}</button><button onClick={() => void copyMermaid()} disabled={!exchanges.length} className="flex items-center gap-1.5 rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-bold text-slate-600 disabled:opacity-40"><Copy size={13} />Copy Mermaid</button></div>
      </div>
      <p role="status" className="px-3 text-sm">{message}</p>
      <div role="region" aria-label="Protocol messages" tabIndex={0} className="max-h-72 space-y-2 overflow-y-auto p-3">
        {exchanges.length === 0 ? <p className="py-8 text-center text-sm text-slate-600">Messages appear here as the run progresses.</p> : exchanges.slice(0, visibleCount ?? exchanges.length).map((exchange) => (
          <button key={exchange.id} aria-pressed={selectedExchangeId === exchange.id} onClick={() => { setPlaying(false); setVisibleCount(null); onSelect(exchange); }} className={`grid w-full grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 rounded-xl border px-3 py-2 text-left transition ${selectedExchangeId === exchange.id ? "border-blue-300 bg-blue-50 shadow-sm" : "border-slate-200 bg-white hover:border-slate-400"}`}>
            <span className="truncate text-xs font-bold text-slate-700">{exchange.actorFrom}</span>
            <span className="flex items-center gap-1 text-[11px] font-semibold text-slate-600"><span>{exchange.method}</span><ArrowRight size={13} /><span className={exchange.status < 400 ? "text-ok" : "text-fail"}>{exchange.status}</span></span>
            <span className="truncate text-right text-xs font-bold text-slate-700">{exchange.actorTo}</span>
            <span className="col-span-3 truncate font-mono text-[10px] text-slate-600">{exchange.url}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
