import { useCallback, useEffect, useMemo, useState } from "react";
import type { Exchange, ImplementationMetadata, RunConfig, RunStep, RunSummary } from "@playground/shared";
import { Activity, ArrowRight, FlaskConical, Play, ShieldCheck } from "lucide-react";
import { io } from "socket.io-client";
import { Inspector } from "./components/Inspector";
import { RoleSelector } from "./components/RoleSelector";
import { RunTimeline } from "./components/RunTimeline";
import { api } from "./lib/api";

const initialConfig: RunConfig = {
  issuer: "inji_certify",
  wallet: "reference_wallet",
  verifier: "inji_verify",
  format: "vc_sd_jwt",
  flow: "cross_device",
  tamper: null,
  scenarioId: null,
};

const tamperOptions: Array<{ value: RunConfig["tamper"]; label: string }> = [
  { value: null, label: "No tamper" },
  { value: "bad_signature", label: "Bad signature" },
  { value: "expired", label: "Expired credential" },
  { value: "wrong_type", label: "Wrong credential type" },
  { value: "missing_disclosure", label: "Missing disclosure" },
  { value: "replay_nonce", label: "Replayed nonce" },
];

export default function App() {
  const [metadata, setMetadata] = useState<ImplementationMetadata | null>(null);
  const [config, setConfig] = useState<RunConfig>(initialConfig);
  const [runId, setRunId] = useState<string | null>(null);
  const [run, setRun] = useState<RunSummary | null>(null);
  const [steps, setSteps] = useState<RunStep[]>([]);
  const [exchanges, setExchanges] = useState<Exchange[]>([]);
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { void api.metadata().then(setMetadata); }, []);

  const refresh = useCallback(async (id: string) => {
    const [nextRun, nextSteps, nextExchanges] = await Promise.all([api.run(id), api.steps(id), api.exchanges(id)]);
    setRun(nextRun);
    setSteps(nextSteps.items);
    setExchanges(nextExchanges.items);
    setSelectedStepId((current) => current ?? nextExchanges.items.at(-1)?.stepId ?? nextSteps.items[0]?.id ?? null);
  }, []);

  useEffect(() => {
    if (!runId) return;
    const socket = io("/runs", { path: "/socket.io" });
    socket.emit("join", runId);
    const update = () => void refresh(runId);
    socket.on("step:started", update);
    socket.on("step:finished", update);
    socket.on("exchange:recorded", update);
    socket.on("run:finished", update);
    const poll = window.setInterval(update, 500);
    void refresh(runId);
    return () => { window.clearInterval(poll); socket.disconnect(); };
  }, [refresh, runId]);

  async function startRun() {
    setBusy(true);
    setRun(null); setSteps([]); setExchanges([]); setSelectedStepId(null);
    try {
      const created = await api.createRun(config);
      setRunId(created.runId);
    } finally {
      setBusy(false);
    }
  }

  const format = metadata?.formats.find((item) => item.id === config.format);
  const selectedExchange = useMemo(() => exchanges.find((item) => item.stepId === selectedStepId) ?? exchanges.at(-1) ?? null, [exchanges, selectedStepId]);
  const runFinished = run && ["passed", "failed", "errored"].includes(run.status);
  const actualLabel = run?.actualOutcome ? `${run.actualOutcome.charAt(0).toUpperCase()}${run.actualOutcome.slice(1)}` : "Unknown";
  const runMessage = !runFinished
    ? "Run in progress…"
    : run.status === "errored"
      ? "Error — the flow could not complete"
      : run.status === "passed"
        ? `✓ ${actualLabel} — expected result matched`
        : `Mismatch — expected ${run.expectedOutcome}, received ${run.actualOutcome}`;

  if (!metadata) return <main className="grid min-h-screen place-items-center text-slate-600"><Activity className="animate-pulse" /> Loading playground…</main>;

  return (
    <div className="min-h-screen bg-canvas text-ink">
      <header className="border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-[1500px] items-center gap-4 px-5 py-4 lg:px-8">
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-ink text-white shadow-lg"><FlaskConical size={22} /></span>
          <div><h1 className="text-lg font-bold tracking-tight">Inji Interoperability Playground</h1><p className="text-xs text-slate-500">Issue, present, verify — and inspect every boundary.</p></div>
          <span className="ml-auto hidden rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800 sm:block">Test data only</span>
        </div>
      </header>

      <main className="dot-grid mx-auto max-w-[1500px] px-5 py-8 lg:px-8">
        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-card">
          <div className="border-b border-slate-200 px-6 py-5 lg:px-8">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div><p className="text-xs font-bold uppercase tracking-[0.2em] text-issuer">Configure a run</p><h2 className="mt-1 text-2xl font-bold tracking-tight">Choose the credential journey</h2></div>
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-500"><ShieldCheck size={16} className="text-ok" />Secrets are masked before recording</div>
            </div>
          </div>
          <div className="grid gap-7 p-6 md:grid-cols-3 lg:p-8">
            <RoleSelector role="issuer" label="1 · Issuer" options={metadata.issuers} value={config.issuer} onChange={(issuer) => setConfig({ ...config, issuer: issuer as RunConfig["issuer"] })} />
            <RoleSelector role="wallet" label="2 · Wallet" options={metadata.wallets} value={config.wallet} onChange={(wallet) => setConfig({ ...config, wallet: wallet as RunConfig["wallet"] })} />
            <RoleSelector role="verifier" label="3 · Verifier" options={metadata.verifiers} value={config.verifier} onChange={(verifier) => setConfig({ ...config, verifier: verifier as RunConfig["verifier"] })} />
          </div>
          <div className="flex flex-col gap-4 border-t border-slate-200 bg-slate-50 px-6 py-5 sm:flex-row sm:items-center lg:px-8">
            <div className="flex flex-wrap gap-2">
              {metadata.formats.map((item) => <button key={item.id} onClick={() => setConfig({ ...config, format: item.id })} className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${config.format === item.id ? "border-ink bg-ink text-white" : "border-slate-300 bg-white text-slate-600 hover:border-slate-500"}`}>{item.name}</button>)}
            </div>
            <label className="flex items-center gap-2 text-sm font-semibold text-slate-600">
              Fault
              <select value={config.tamper ?? ""} onChange={(event) => setConfig({ ...config, tamper: (event.target.value || null) as RunConfig["tamper"] })} className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-ink">
                {tamperOptions.map((item) => <option key={item.value ?? "none"} value={item.value ?? ""}>{item.label}</option>)}
              </select>
            </label>
            <div className="sm:ml-auto"><button disabled={busy} onClick={() => void startRun()} className="flex w-full items-center justify-center gap-2 rounded-xl bg-issuer px-6 py-3 text-sm font-bold text-white shadow-lg shadow-blue-200 transition hover:-translate-y-0.5 hover:bg-blue-700 disabled:cursor-wait disabled:opacity-60 sm:w-auto"><Play size={17} fill="currentColor" />{busy ? "Starting…" : "Run flow"}</button></div>
          </div>
        </section>

        <section className="mt-7 rounded-3xl border border-slate-200 bg-white shadow-card">
          <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 px-6 py-5 lg:px-8">
            <div><p className="text-xs font-bold uppercase tracking-[0.2em] text-wallet">Live run</p><h2 className="mt-1 text-xl font-bold">{run ? `Run ${run.id.slice(0, 8)}` : "Ready when you are"}</h2></div>
            {format && <div className="ml-auto flex flex-wrap gap-2"><span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold">{format.name}</span><span className="rounded-full bg-green-50 px-3 py-1.5 text-xs font-semibold text-green-800">{format.proofType}</span><span className="rounded-full bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-800">{format.algorithm}</span></div>}
          </div>
          {!runId ? <div className="grid min-h-72 place-items-center p-8 text-center"><div><ArrowRight className="mx-auto mb-3 text-slate-300" size={36} /><p className="font-semibold text-slate-600">Start a flow to see the live protocol timeline.</p><p className="mt-1 text-sm text-slate-400">Protocol exchanges are sanitized before storage.</p></div></div> : (
            <div className="grid gap-6 p-6 lg:grid-cols-[340px_minmax(0,1fr)] lg:p-8">
              <div>
                <div className={`mb-4 rounded-xl border px-4 py-3 text-sm font-semibold ${run?.status === "passed" ? "border-green-200 bg-green-50 text-ok" : runFinished ? "border-red-200 bg-red-50 text-fail" : "border-blue-200 bg-blue-50 text-issuer"}`} aria-live="polite">{runMessage}</div>
                <RunTimeline steps={steps} selectedStepId={selectedStepId} onSelect={setSelectedStepId} />
              </div>
              <Inspector exchange={selectedExchange} />
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
