import { PublicEvidence } from "./PublicEvidence";
import { publicStructure } from "../lib/publicStructure";
import type { Exchange } from "@playground/shared";
import { ArrowRight, LockKeyhole } from "lucide-react";

export function Inspector({ exchange }: { exchange: Exchange | null }) {
  if (!exchange) {
    return <div className="grid min-h-80 place-items-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-500">Select a completed protocol step to inspect its messages.</div>;
  }
  const panels: Array<{ label: string; value: unknown }> = [
    { label: "Request", value: exchange.request },
    { label: "Response", value: exchange.response },
  ];
  return (
    <article aria-label="Protocol message inspector" className="overflow-hidden rounded-2xl border border-slate-200 bg-[#111827] text-slate-100">
      <p role="status" className="sr-only">Selected exchange {exchange.seq}: {exchange.actorFrom} to {exchange.actorTo}, HTTP {exchange.status}.</p>
      <header className="border-b border-white/10 bg-white/5 px-5 py-4">
        <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
          <span>{exchange.actorFrom}</span><ArrowRight size={13} /><span>{exchange.actorTo}</span>
          <span className="ml-auto rounded-full bg-green-400/15 px-2.5 py-1 text-green-300">{exchange.status} · {exchange.durationMs} ms</span>
        </div>
        <p className="mt-2 text-xs text-slate-300">HTTP status describes transport only. Read the independent verifier result for the credential verdict.</p>
        <div className="mt-2 break-all font-mono text-xs"><strong className="mr-2 text-cyan-300">{exchange.method}</strong>{exchange.url}</div>
      </header>
      <div className="grid gap-px bg-white/10 md:grid-cols-2">
        {panels.map(({ label, value }) => (
          <section key={label} className="min-w-0 bg-[#111827] p-5">
            <h3 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-slate-400">{label}{exchange.redactions.length > 0 && <LockKeyhole size={13} className="text-amber-300" />}</h3>
            <PublicEvidence value={value} label={label} />
            <details className="mt-4"><summary className="cursor-pointer">Projected structure details</summary><pre className="overflow-auto whitespace-pre-wrap break-words font-mono text-xs leading-6 text-slate-200">{JSON.stringify(publicStructure(value), null, 2)}</pre></details>
          </section>
        ))}
      </div>
    </article>
  );
}
