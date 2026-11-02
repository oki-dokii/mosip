import { PublicEvidence } from "./PublicEvidence";
import { publicStructure } from "../lib/publicStructure";
import type { Exchange } from "@playground/shared";
import { ArrowRight, LockKeyhole } from "lucide-react";

export function Inspector({ exchange }: { exchange: Exchange | null }) {
  if (!exchange) {
    return <div className="grid min-h-48 place-items-center rounded-xl border border-dashed border-slate-300 bg-slate-50/50 p-6 text-center text-xs text-slate-500">Select a completed protocol step to inspect its messages.</div>;
  }
  const panels: Array<{ label: string; value: unknown }> = [
    { label: "Request", value: exchange.request },
    { label: "Response", value: exchange.response },
  ];
  return (
    <article aria-label="Protocol message inspector" className="overflow-hidden rounded-xl border border-slate-700/60 bg-[#111827] text-slate-100 shadow-sm">
      <p role="status" className="sr-only">Selected exchange {exchange.seq}: {exchange.actorFrom} to {exchange.actorTo}, HTTP {exchange.status}.</p>
      <header className="border-b border-white/10 bg-white/5 px-4 py-3">
        <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
          <span className="font-mono text-slate-200">{exchange.actorFrom}</span><ArrowRight size={12} /><span className="font-mono text-slate-200">{exchange.actorTo}</span>
          <span className="ml-auto rounded-full bg-green-400/15 px-2 py-0.5 text-xs font-mono text-green-300">{exchange.status} · {exchange.durationMs} ms</span>
        </div>
        <p className="mt-1 text-[11px] text-slate-400">HTTP status describes transport only. Read the independent verifier result for the credential verdict.</p>
        <div className="mt-1.5 break-all font-mono text-xs"><strong className="mr-2 text-cyan-300 font-bold">{exchange.method}</strong><span className="text-slate-300">{exchange.url}</span></div>
      </header>
      <div className="grid gap-px bg-white/10 md:grid-cols-2">
        {panels.map(({ label, value }) => (
          <section key={label} className="min-w-0 bg-[#111827] p-4">
            <h3 className="mb-2.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-400">{label}{exchange.redactions.length > 0 && <LockKeyhole size={12} className="text-amber-300" />}</h3>
            <PublicEvidence value={value} label={label} />
            <details className="mt-3 text-xs"><summary className="cursor-pointer text-cyan-400 hover:text-cyan-300 transition">Projected structure details</summary><pre className="mt-2 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-black/40 p-2.5 font-mono text-xs leading-normal text-slate-200 border border-white/5">{JSON.stringify(publicStructure(value), null, 2)}</pre></details>
          </section>
        ))}
      </div>
    </article>
  );
}
