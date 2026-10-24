import { WalletEvidencePanel } from "./components/WalletEvidencePanel";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Exchange, ImplementationMetadata, RunConfig, RunStep, RunSummary, ScenarioDefinition } from "@playground/shared";
import { evidenceLabels, evidenceTier } from "@playground/shared/evidence";
import { Activity, ArrowRight, FlaskConical, Play, ShieldCheck } from "lucide-react";
import { io } from "socket.io-client";
import { Inspector } from "./components/Inspector";
import { RoleSelector } from "./components/RoleSelector";
import { RunTimeline } from "./components/RunTimeline";
import { RunArchive } from "./components/RunArchive";
import { GapExplorer } from "./components/GapExplorer";
import { SequenceView } from "./components/SequenceView";
import { ConnectedAssisted } from "./components/ConnectedAssisted";
import { CaptureCoverage } from "./components/CaptureCoverage";
import { api } from "./lib/api";
import { AssistedJourneyPanel } from "./components/AssistedJourneyPanel";
import { createAssistedFixture } from "./lib/assistedFixture";
import { assistedUnavailable } from "./lib/assistedJourney";

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
  { value: "replay_nonce", label: "Nonce mismatch" },
];

export default function App() {
  const [metadata, setMetadata] = useState<ImplementationMetadata | null>(null);
  const [scenarios, setScenarios] = useState<ScenarioDefinition[]>([]);
  const [driverMode, setDriverMode] = useState<"fixture" | "collab" | null>(null);
  const [config, setConfig] = useState<RunConfig>(initialConfig);
  const [runId, setRunId] = useState<string | null>(null);
  const activeRunId = useRef(runId);
  activeRunId.current = runId;
  const [run, setRun] = useState<RunSummary | null>(null);
  const [steps, setSteps] = useState<RunStep[]>([]);
  const [exchanges, setExchanges] = useState<Exchange[]>([]);
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null);
  const [selectedExchangeId, setSelectedExchangeId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [assisted, setAssisted] = useState<ReturnType<typeof createAssistedFixture> | null>(null);
  const [startError, setStartError] = useState<string | null>(null);
  useEffect(() => () => assisted?.journey.dispose(), [assisted]);
  const [history, setHistory] = useState<RunSummary[]>([]);
  const [matrix, setMatrix] = useState<RunSummary[]>([]);
  const [archiveView, setArchiveView] = useState<"history" | "matrix">("history");
  const archivedRunId = useRef<string | null>(null);

  const refreshArchive = useCallback(async () => {
    const [runs, latest] = await Promise.all([api.runs(), api.matrix()]);
    setHistory(runs.items);
    setMatrix(latest.items);
  }, []);

  useEffect(() => { void Promise.all([api.metadata().then(setMetadata), api.scenarios().then((result) => setScenarios(result.items)), api.health().then((health) => setDriverMode(health.driverMode)), refreshArchive()]); }, [refreshArchive]);

  const refresh = useCallback(async (id: string) => {
    const [nextRun, nextSteps, nextExchanges] = await Promise.all([api.run(id), api.steps(id), api.exchanges(id)]);
    if (activeRunId.current !== id) return;
    setRun(nextRun);
    setSteps(nextSteps.items);
    setExchanges(nextExchanges.items);
    setSelectedStepId((current) => current ?? nextExchanges.items.at(-1)?.stepId ?? nextSteps.items[0]?.id ?? null);
    setSelectedExchangeId((current) => current ?? nextExchanges.items.at(-1)?.id ?? null);
    if (["passed", "failed", "errored", "cancelled"].includes(nextRun.status) && archivedRunId.current !== nextRun.id) {
      archivedRunId.current = nextRun.id;
      void refreshArchive();
    }
  }, [refreshArchive]);

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
    setStartError(null);
    if (config.wallet === "inji_web_assisted") {
      const reason = assistedUnavailable(config);
      if (reason) { setStartError(reason); return; }
      assisted?.journey.dispose();
      setAssisted(createAssistedFixture(crypto.randomUUID()));
      return;
    }
    assisted?.journey.dispose();
    setAssisted(null);
    setBusy(true);
    setRun(null); setSteps([]); setExchanges([]); setSelectedStepId(null); setSelectedExchangeId(null);
    try {
      const created = await api.createRun(config);
      setRunId(created.runId);
    } catch {
      setStartError("Could not start the run. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function replayRun() {
    if (!run) return;
    setBusy(true);
    try {
      const created = await api.replayRun(run.id, config.tamper);
      setRun(null); setSteps([]); setExchanges([]); setSelectedStepId(null); setSelectedExchangeId(null);
      setRunId(created.runId);
    } finally {
      setBusy(false);
    }
  }

  function selectArchivedRun(id: string) {
    setRun(null); setSteps([]); setExchanges([]); setSelectedStepId(null); setSelectedExchangeId(null);
    setRunId(id);
    window.scrollTo({ top: 430, behavior: "smooth" });
  }

  const format = metadata?.formats.find((item) => item.id === (run?.config.format ?? config.format));
  const unsupportedReason = assistedUnavailable(config) ?? (config.wallet === "inji_web_assisted" ? null : driverMode === "collab" && (config.issuer === "mock_issuer" || config.verifier === "mock_verifier") && config.format !== "vc_sd_jwt"
        ? "Local non-Inji mock roles currently support SD-JWT VC only."
        : driverMode === "collab" && (config.tamper === "expired" || config.tamper === "wrong_type") && (config.issuer !== "mock_issuer" || config.format !== "vc_sd_jwt")
          ? "Expiry and type tests require the controlled SD-JWT mock issuer."
        : driverMode === "collab" && config.tamper === "missing_disclosure" && (config.issuer !== "mock_issuer" || config.verifier !== "mock_verifier")
          ? "Missing-disclosure tests require the controlled mock issuer and verifier policy."
        : null);
  const selectedExchange = useMemo(() => exchanges.find((item) => item.id === selectedExchangeId) ?? exchanges.find((item) => item.stepId === selectedStepId) ?? exchanges.at(-1) ?? null, [exchanges, selectedExchangeId, selectedStepId]);
  const selectStep = useCallback((stepId: string) => {
    setSelectedStepId(stepId);
    setSelectedExchangeId(exchanges.find((item) => item.stepId === stepId)?.id ?? null);
  }, [exchanges]);
  const selectExchange = useCallback((exchange: Exchange) => {
    setSelectedStepId(exchange.stepId);
    setSelectedExchangeId(exchange.id);
  }, []);
  const runFinished = run && ["passed", "failed", "errored", "cancelled"].includes(run.status);
  const actualLabel = run?.actualOutcome ? `${run.actualOutcome.charAt(0).toUpperCase()}${run.actualOutcome.slice(1)}` : "Unknown";
  const runMessage = !runFinished
    ? "Run in progress…"
    : run.status === "errored"
      ? "Error — the flow could not complete"
      : run.status === "cancelled" ? "Cancelled — no verifier verdict established"
      : run.status === "passed"
        ? `✓ ${actualLabel} — expected result matched`
        : run.evaluation ? `Validation: ${run.evaluation.verdict.replaceAll("_", " ")}` : `Mismatch — expected ${run.expectedOutcome}, received ${run.actualOutcome}`;
  const verifierDetail = steps.find((step) => step.stepKey === "PRESENT_RESULT")?.summary?.failureDetail;
  const selectedScenario = scenarios.find((item) => item.id === config.scenarioId);
  const scenarioGaps = [...new Set(scenarios.flatMap((item) => item.unavailableReason ? [item.unavailableReason] : []))];

  if (!metadata) return <main className="grid min-h-screen place-items-center text-slate-600"><Activity className="animate-pulse" /> Loading playground…</main>;

  return (
    <div className="min-h-screen bg-canvas text-ink">
      <header className="border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-[1500px] items-center gap-4 px-5 py-4 lg:px-8">
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-ink text-white shadow-lg"><FlaskConical size={22} /></span>
          <div><h1 className="text-lg font-bold tracking-tight">Inji Interoperability Playground</h1><p className="text-xs text-slate-500">Issue, present, verify — and inspect every boundary.</p></div>
          <span className="ml-auto hidden rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800 sm:block">{run?.config.wallet === "inji_web_assisted" && run.serviceVersions && !run.serviceVersions.wallet.startsWith("fixture/") ? "Live assisted wallet · test data" : driverMode === "fixture" ? "Fixture simulation · test data" : "Live Collab · test data"}</span>
        </div>
      </header>

      <main className="dot-grid mx-auto max-w-[1500px] px-5 py-8 lg:px-8">
        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-card">
          <div className="border-b border-slate-200 px-6 py-5 lg:px-8">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div><p className="text-xs font-bold uppercase tracking-[0.2em] text-issuer">Configure a run</p><h2 className="mt-1 text-2xl font-bold tracking-tight">Choose the credential journey</h2></div>
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-500"><ShieldCheck size={16} className="text-ok" />Secrets are masked before recording</div>
            </div>
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <label htmlFor="scenario-preset" className="text-sm font-semibold text-slate-700">Scenario</label>
              <select id="scenario-preset" value={config.scenarioId ?? ""} onChange={(event) => {
                const scenario = scenarios.find((item) => item.id === event.target.value);
                setConfig(scenario ? scenario.config : { ...config, scenarioId: null });
              }} className="min-w-0 max-w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-ink">
                <option value="">Custom configuration</option>
                {scenarios.map((scenario) => <option key={scenario.id} value={scenario.id} disabled={!scenario.available}>{scenario.name}{scenario.available ? "" : " · unavailable"}</option>)}
              </select>
              {selectedScenario && <span className="text-xs text-slate-500">{selectedScenario.description}</span>}
              {scenarioGaps.length > 0 && <p className="basis-full text-xs text-amber-800">Preset setup: {scenarioGaps.join(" ")}</p>}
            </div>
          </div>
          <div className="grid gap-7 p-6 md:grid-cols-3 lg:p-8">
            <RoleSelector role="issuer" label="1 · Issuer" options={metadata.issuers} value={config.issuer} onChange={(issuer) => setConfig({ ...config, issuer: issuer as RunConfig["issuer"], scenarioId: null })} />
            <RoleSelector role="wallet" label="2 · Wallet" options={metadata.wallets.map((wallet) => ({ ...wallet,
              name: wallet.id === "reference_wallet" ? "Reference Wallet" : "Inji Web (Assisted)",
              description: wallet.id === "reference_wallet" ? "Automated, code-level driver" : config.format === "ldp_vc" ? "JSON-LD presentation · fixture rehearsal available" : "SD-JWT Web presentation unavailable · select JSON-LD",
              disabled: wallet.id === "inji_web_assisted" && config.format !== "ldp_vc",
            }))} value={config.wallet} onChange={(wallet) => setConfig({ ...config, wallet: wallet as RunConfig["wallet"], scenarioId: null })} />
            <RoleSelector role="verifier" label="3 · Verifier" options={metadata.verifiers} value={config.verifier} onChange={(verifier) => setConfig({ ...config, verifier: verifier as RunConfig["verifier"], scenarioId: null })} />
          </div>
          <div className="flex flex-col gap-4 border-t border-slate-200 bg-slate-50 px-6 py-5 sm:flex-row sm:items-center lg:px-8">
            <div className="flex flex-wrap gap-2">
              {metadata.formats.map((item) => <button key={item.id} onClick={() => setConfig({ ...config, format: item.id, scenarioId: null })} className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${config.format === item.id ? "border-ink bg-ink text-white" : "border-slate-300 bg-white text-slate-600 hover:border-slate-500"}`}>{item.name}</button>)}
            </div>
            <label className="flex items-center gap-2 text-sm font-semibold text-slate-600">
              Fault
              <select value={config.tamper ?? ""} onChange={(event) => setConfig({ ...config, tamper: (event.target.value || null) as RunConfig["tamper"], scenarioId: null })} className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-ink">
                {tamperOptions.map((item) => <option key={item.value ?? "none"} value={item.value ?? ""}>{item.label}</option>)}
              </select>
            </label>
            {unsupportedReason && <p role="status" className="text-xs font-semibold text-amber-800">{unsupportedReason}</p>}
            <div className="sm:ml-auto"><button disabled={busy || !driverMode || Boolean(unsupportedReason)} onClick={() => void startRun()} className="flex w-full items-center justify-center gap-2 rounded-xl bg-issuer px-6 py-3 text-sm font-bold text-white shadow-lg shadow-blue-200 transition hover:-translate-y-0.5 hover:bg-blue-700 disabled:cursor-wait disabled:opacity-60 sm:w-auto"><Play size={17} fill="currentColor" />{busy ? "Starting…" : config.wallet === "inji_web_assisted" ? "Start assisted fixture run" : "Run flow"}</button></div>
          </div>
        </section>

        {startError && <p role="alert" className="mt-4 text-red-800">{startError}</p>}
        {config.wallet === "inji_web_assisted" && <p className="mt-4 text-sm text-amber-900">Live assisted start requires a configured deployment and dedicated account. The backend-assisted journey below supports connected fixtures and configured live runs.</p>}
        {((config.wallet === "inji_web_assisted" && !assistedUnavailable(config)) || run?.config.wallet === "inji_web_assisted") && <ConnectedAssisted config={run?.config.wallet === "inji_web_assisted" ? run.config : config} resumeId={run?.config.wallet === "inji_web_assisted" ? run.id : null} onRun={setRunId} />}
        {assisted && <AssistedJourneyPanel key={assisted.journey.runId} fixture={assisted} />}
        <section className="mt-7 rounded-3xl border border-slate-200 bg-white shadow-card">
          <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 px-6 py-5 lg:px-8">
            <div><p className="text-xs font-bold uppercase tracking-[0.2em] text-wallet">Live run</p><h2 className="mt-1 text-xl font-bold">{run ? `Run ${run.id.slice(0, 8)}` : "Ready when you are"}</h2></div>
            {format && <div className="ml-auto flex flex-wrap gap-2"><span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold">{format.name}</span><span className="rounded-full bg-green-50 px-3 py-1.5 text-xs font-semibold text-green-800">{format.proofType}</span><span className="rounded-full bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-800">{format.algorithm}</span></div>}
          </div>
          {!runId ? <div className="grid min-h-72 place-items-center p-8 text-center"><div><ArrowRight className="mx-auto mb-3 text-slate-300" size={36} /><p className="font-semibold text-slate-600">Start a flow to see the live protocol timeline.</p><p className="mt-1 text-sm text-slate-400">Protocol exchanges are sanitized before storage.</p></div></div> : (
            <div className="grid gap-6 p-6 lg:grid-cols-[340px_minmax(0,1fr)] lg:p-8">
              <div>
                <div className={`mb-4 rounded-xl border px-4 py-3 text-sm font-semibold ${run?.status === "passed" ? "border-green-200 bg-green-50 text-ok" : runFinished ? "border-red-200 bg-red-50 text-fail" : "border-blue-200 bg-blue-50 text-issuer"}`} aria-live="polite">{runMessage}</div>
                {run && <p className="mb-4 text-xs font-semibold text-slate-600">Evidence: {evidenceLabels[evidenceTier(run)]}</p>}
                {run?.evaluation && <p className="mb-4 text-xs text-slate-700">Validation: {run.evaluation.verdict.replaceAll("_", " ")}{run.evaluation.observed.code ? ` · ${run.evaluation.observed.code}` : ""}</p>}
                {typeof verifierDetail === "string" && <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">Verifier detail: {verifierDetail}</p>}
                {runFinished && run?.config.wallet !== "inji_web_assisted" && run?.status !== "errored" && run?.status !== "cancelled" && <button disabled={busy} onClick={() => void replayRun()} className="mb-4 w-full rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:border-slate-500 disabled:opacity-60">Replay with selected fault</button>}
                {runFinished && run && <div className="mb-4 grid grid-cols-2 gap-2 text-center text-xs font-bold"><a className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-700 hover:border-slate-500" href={`/api/v1/runs/${run.id}/report?format=md`}>Report · Markdown</a><a className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-700 hover:border-slate-500" href={`/api/v1/runs/${run.id}/report?format=json`}>Report · JSON</a></div>}
                <RunTimeline steps={steps} selectedStepId={selectedStepId} onSelect={selectStep} />
              </div>
              <div><CaptureCoverage key={runId} runId={runId} exchangeCount={exchanges.length} canImport={Boolean(runFinished) || run?.config.wallet === "inji_web_assisted"} onImported={() => void refresh(runId)} /><SequenceView runId={runId} exchanges={exchanges} selectedExchangeId={selectedExchangeId} onSelect={selectExchange} /><Inspector exchange={selectedExchange} /></div>
            </div>
          )}
        </section>
        <WalletEvidencePanel />
        <RunArchive history={history} matrix={matrix} active={archiveView} onActiveChange={setArchiveView} onSelectRun={selectArchivedRun} />
        <GapExplorer />
      </main>
    </div>
  );
}
