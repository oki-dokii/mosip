import { ReadingPreferences, useReadingPreferences } from "./components/ReadingPreferences";
import { WalletEvidencePanel } from "./components/WalletEvidencePanel";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Exchange, ImplementationMetadata, RunConfig, RunStep, RunSummary, ScenarioDefinition } from "@playground/shared";
import { evidenceLabels, evidenceTier } from "@playground/shared/evidence";
import { Activity, ArrowRight, FlaskConical, Menu, Play, ShieldCheck, Sparkles } from "lucide-react";
import { io } from "socket.io-client";
import { Inspector } from "./components/Inspector";
import { RoleSelector } from "./components/RoleSelector";
import { RunTimeline } from "./components/RunTimeline";
import { useArchiveLocation, versionsFor } from "./lib/archiveLocation";
import { RunComparison } from "./components/RunComparison";
import { RunArchive } from "./components/RunArchive";
import { GapExplorer } from "./components/GapExplorer";
import { SequenceView } from "./components/SequenceView";
import { ConnectedAssisted } from "./components/ConnectedAssisted";
import { CaptureCoverage } from "./components/CaptureCoverage";
import { RightSidebar } from "./components/RightSidebar";
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
  const { t, locale } = useReadingPreferences();
  const [metadata, setMetadata] = useState<ImplementationMetadata | null>(null);
  const [scenarios, setScenarios] = useState<ScenarioDefinition[]>([]);
  const [driverMode, setDriverMode] = useState<"fixture" | "collab" | null>(null);
  const [config, setConfig] = useState<RunConfig>(initialConfig);
  const [history, setHistory] = useState<RunSummary[]>([]);
  const [matrix, setMatrix] = useState<RunSummary[]>([]);
  const [archiveReady, setArchiveReady] = useState(false);
  const [archiveError, setArchiveError] = useState(false);
  const versions = useMemo(() => versionsFor([...history, ...matrix]), [history, matrix]);
  const location = useArchiveLocation(versions, archiveReady);
  const runId = location.state.run || null;
  const setRunId = (id: string) => location.update({ run: id });
  const archiveView = location.state.view;
  const setArchiveView = (view: "history" | "matrix") => location.update({ view });
  const runHeading = useRef<HTMLHeadingElement>(null);
  const archiveOpener = useRef<HTMLElement | null>(null);
  const previousRun = useRef<string | null>(null);
  const [runError, setRunError] = useState(false);
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
  const archivedRunId = useRef<string | null>(null);

  const refreshArchive = useCallback(async () => {
    try {
      const [runs, latest] = await Promise.all([api.runs(), api.matrix()]);
      setHistory(runs.items);
      setMatrix(latest.items);
      setArchiveReady(true); setArchiveError(false);
    } catch { setArchiveError(true); }
  }, []);

  useEffect(() => { void Promise.all([api.metadata().then(setMetadata), api.scenarios().then((result) => setScenarios(result.items)), api.health().then((health) => setDriverMode(health.driverMode)), refreshArchive()]).catch(() => setStartError("Playground configuration unavailable. Reload to retry.")); }, [refreshArchive]);

  const refresh = useCallback(async (id: string) => {
    const [nextRun, nextSteps, nextExchanges] = await Promise.all([api.run(id), api.steps(id), api.exchanges(id)]);
    if (activeRunId.current !== id) return;
    if (nextRun.id !== id) throw new Error("Run mismatch");
    setRunError(false);
    setRun(nextRun);
    setSteps(nextSteps.items.filter(step => step.runId === id));
    setExchanges(nextExchanges.items.filter(exchange => exchange.runId === id));
    setSelectedStepId((current) => current ?? nextExchanges.items.at(-1)?.stepId ?? nextSteps.items[0]?.id ?? null);
    setSelectedExchangeId((current) => current ?? nextExchanges.items.at(-1)?.id ?? null);
    if (["passed", "failed", "errored", "cancelled"].includes(nextRun.status) && archivedRunId.current !== nextRun.id) {
      archivedRunId.current = nextRun.id;
      void refreshArchive();
    }
  }, [refreshArchive]);

  useEffect(() => {
    setRun(null); setSteps([]); setExchanges([]); setSelectedStepId(null); setSelectedExchangeId(null); setRunError(false);
    if (!runId) return;
    const socket = io("/runs", { path: "/socket.io" });
    socket.emit("join", runId);
    const update = () => void refresh(runId).catch(() => { if (activeRunId.current === runId) { setRunError(true); setRun(null); setSteps([]); setExchanges([]); } });
    socket.on("step:started", update);
    socket.on("step:finished", update);
    socket.on("exchange:recorded", update);
    socket.on("run:finished", update);
    const poll = window.setInterval(update, 500);
    update();
    return () => { window.clearInterval(poll); socket.disconnect(); };
  }, [refresh, runId]);

  useEffect(() => {
    if (runId) {
      runHeading.current?.focus({ preventScroll: true });
      runHeading.current?.scrollIntoView?.({ block: "start", behavior: window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
    } else if (previousRun.current) {
      const opener = archiveOpener.current?.isConnected ? archiveOpener.current : document.querySelector<HTMLElement>(`[data-open-run="${previousRun.current}"]`);
      (opener ?? document.querySelector<HTMLElement>('[aria-label="Run archive"]'))?.focus();
    }
    previousRun.current = runId;
  }, [runId, metadata]);

  const [localReady, setLocalReady] = useState(false);
  useEffect(() => {
    if (import.meta.env.VITE_ASSISTED_LOCAL_PROFILE !== "jsonld-0.14") return;
    void api.assistedCapabilities().then(c => setLocalReady(c.liveAvailable && c.localJsonLd === true)).catch(() => setLocalReady(false));
  }, []);
  async function startLocalWallet() {
    setBusy(true); setStartError(null);
    const localConfig: RunConfig = { ...initialConfig, wallet: "inji_web_assisted", format: "ldp_vc" };
    try {
      const { runId: id } = await api.startAssisted(localConfig, "live");
      assisted?.journey.dispose(); setAssisted(null); setConfig(localConfig); setRunId(id);
    } catch { setStartError("Local wallet run could not start. Check the assisted service and capture bridge."); }
    finally { setBusy(false); }
  }

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
    } catch { setStartError("Replay unavailable. Please try again."); } finally {
      setBusy(false);
    }
  }

  function selectArchivedRun(id: string) {
    setRun(null); setSteps([]); setExchanges([]); setSelectedStepId(null); setSelectedExchangeId(null);
    setRunId(id);
    archiveOpener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
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

  if (!metadata) return <main className="grid min-h-screen place-items-center p-6 text-slate-600"><div><h1 className="text-xl font-bold">Inji Interoperability Playground</h1>{startError ? <p role="alert">{startError}</p> : <p role="status"><Activity aria-hidden="true" className="animate-pulse" /> Loading playground…</p>}</div></main>;

  return (
    <div className="min-h-screen bg-canvas text-ink antialiased">
      <a className="skip-link" href="#playground-main">Skip to main content</a>
      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/95 backdrop-blur dark:border-white/10 dark:bg-[#090d16]/95">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-2.5 sm:px-6">
          <div className="flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-md shadow-blue-500/20"><FlaskConical size={18} /></span>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm font-bold tracking-tight text-ink dark:text-white sm:text-base">Inji Interoperability Playground</h1>
                <span className="hidden rounded-full border border-amber-300/40 bg-amber-500/10 px-2.5 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-300 md:inline-block">
                  {run?.recordKind === "archived_evidence" ? "Archived real-wallet evidence · 25 Oct" : run?.config.wallet === "inji_web_assisted" && run.serviceVersions && !run.serviceVersions.wallet.startsWith("fixture/") ? "Live assisted wallet · test data" : driverMode === "fixture" ? "Fixture simulation · test data" : "Live Collab · test data"}
                </span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300">Issue, present, verify — and inspect every boundary.</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <nav aria-label="Explore" className="hidden sm:flex items-center gap-1 rounded-lg bg-slate-100/80 p-0.5 dark:bg-white/5">
              <a className="rounded-md px-2.5 py-1 text-xs font-semibold text-slate-600 hover:text-ink dark:text-slate-300 dark:hover:text-white transition" href="/parties">Parties</a>
              <a className="rounded-md px-2.5 py-1 text-xs font-semibold text-slate-600 hover:text-ink dark:text-slate-300 dark:hover:text-white transition" href="/capabilities">QR and capabilities</a>
              <a className="rounded-md px-2.5 py-1 text-xs font-semibold text-slate-600 hover:text-ink dark:text-slate-300 dark:hover:text-white transition" href="/android">Android wallet</a>
            </nav>
            <ReadingPreferences />
            <button
              type="button"
              onClick={() => window.dispatchEvent(new CustomEvent("open-right-sidebar"))}
              className="flex items-center gap-1.5 rounded-lg border border-slate-300/80 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10 transition"
              aria-label="Open navigation steps"
            >
              <Menu size={15} />
              <span className="hidden sm:inline">Steps</span>
            </button>
          </div>
        </div>
      </header>

      <main id="playground-main" tabIndex={-1} className="dot-grid mx-auto max-w-7xl px-4 py-5 sm:px-6 space-y-4">
        {localReady && <button disabled={busy || run?.status === "running" || run?.status === "pending"} onClick={() => void startLocalWallet()} className="rounded-lg bg-issuer px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-blue-600 transition">Start local JSON-LD wallet run</button>}
        <details className="group rounded-xl border border-slate-200/90 bg-gradient-to-r from-blue-50/40 via-white to-slate-50/40 p-3 shadow-xs dark:border-white/10 dark:from-blue-950/20 dark:via-white/5 dark:to-white/5">
          <summary className="flex cursor-pointer items-center justify-between font-bold text-xs text-slate-700 hover:text-ink dark:text-slate-300 dark:hover:text-white">
            <div className="flex items-center gap-2">
              <span className="grid h-5 w-5 place-items-center rounded-md bg-blue-500/10 text-issuer dark:bg-blue-400/15 dark:text-blue-300">
                <Sparkles size={12} />
              </span>
              <span>Your first five minutes</span>
            </div>
            <span className="rounded-full bg-slate-200/60 px-2 py-0.5 text-[10px] font-medium text-slate-700 group-open:bg-blue-100 group-open:text-issuer dark:bg-white/10 dark:text-slate-300 dark:group-open:bg-blue-900/40 dark:group-open:text-blue-300 transition">
              Quick start guide
            </span>
          </summary>
          <div className="mt-2.5 pt-2.5 border-t border-slate-200/60 dark:border-white/5">
            <ol className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 list-none pl-0 text-xs">
              <li className="rounded-lg border border-slate-200/70 bg-white/80 p-2.5 dark:border-white/5 dark:bg-white/5">
                <div className="font-bold text-issuer dark:text-blue-400 mb-0.5">1 · Happy Path</div>
                <div className="text-slate-700 dark:text-slate-300 leading-snug">Choose a mock happy path and start the run.</div>
              </li>
              <li className="rounded-lg border border-slate-200/70 bg-white/80 p-2.5 dark:border-white/5 dark:bg-white/5">
                <div className="font-bold text-wallet dark:text-emerald-400 mb-0.5">2 · Inspect Flow</div>
                <div className="text-slate-700 dark:text-slate-300 leading-snug">Open a timeline step to inspect the actors, HTTP status and redacted exchange.</div>
              </li>
              <li className="rounded-lg border border-slate-200/70 bg-white/80 p-2.5 dark:border-white/5 dark:bg-white/5">
                <div className="font-bold text-verifier dark:text-amber-400 mb-0.5">3 · Test Faults</div>
                <div className="text-slate-700 dark:text-slate-300 leading-snug">Run the bad-signature scenario and compare its verdict with the positive control.</div>
              </li>
              <li className="rounded-lg border border-slate-200/70 bg-white/80 p-2.5 dark:border-white/5 dark:bg-white/5">
                <div className="font-bold text-slate-700 dark:text-slate-300 mb-0.5">4 · Evidence Matrix</div>
                <div className="text-slate-700 dark:text-slate-300 leading-snug">Open the compatibility matrix to see which configurations have evidence.</div>
              </li>
            </ol>
          </div>
        </details>
        <section id="configure-run" className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-5 py-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-issuer">Configure a run</p>
                <h2 className="mt-0.5 text-lg font-bold tracking-tight">Choose the credential journey</h2>
              </div>
              <div className="flex items-center gap-1.5 text-xs font-medium text-slate-700"><ShieldCheck size={15} className="text-ok" />Secrets are masked before recording</div>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2.5">
              <label lang={locale} htmlFor="scenario-preset" className="text-xs font-semibold text-slate-700">{t("scenario")}</label>
              <select id="scenario-preset" value={config.scenarioId ?? ""} onChange={(event) => {
                const scenario = scenarios.find((item) => item.id === event.target.value);
                setConfig(scenario ? scenario.config : { ...config, scenarioId: null });
              }} className="min-w-0 max-w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-ink shadow-xs">
                <option lang={locale} value="">{t("custom")}</option>
                {scenarios.map((scenario) => <option key={scenario.id} value={scenario.id} disabled={!scenario.available}>{scenario.name}{scenario.available ? "" : " · unavailable"}</option>)}
              </select>
              {selectedScenario && <span className="text-xs text-slate-700 dark:text-slate-300">{selectedScenario.description}</span>}
              {scenarioGaps.length > 0 && <p className="basis-full text-xs text-amber-800">Preset setup: {scenarioGaps.join(" ")}</p>}
            </div>
          </div>
          <div className="grid gap-4 p-5 md:grid-cols-3">
            <RoleSelector role="issuer" label={<span lang={locale}>{t("issuer")}</span>} options={metadata.issuers} value={config.issuer} onChange={(issuer) => setConfig({ ...config, issuer: issuer as RunConfig["issuer"], scenarioId: null })} />
            <RoleSelector role="wallet" label={<span lang={locale}>{t("wallet")}</span>} options={metadata.wallets.map((wallet) => ({ ...wallet,
              name: wallet.id === "reference_wallet" ? "Reference Wallet" : "Inji Web (Assisted)",
              description: wallet.id === "reference_wallet" ? "Automated, code-level driver" : config.format === "ldp_vc" ? "JSON-LD presentation · fixture rehearsal available" : "SD-JWT Web presentation unavailable · select JSON-LD",
              disabled: wallet.id === "inji_web_assisted" && config.format !== "ldp_vc",
            }))} value={config.wallet} onChange={(wallet) => setConfig({ ...config, wallet: wallet as RunConfig["wallet"], scenarioId: null })} />
            <RoleSelector role="verifier" label={<span lang={locale}>{t("verifier")}</span>} options={metadata.verifiers} value={config.verifier} onChange={(verifier) => setConfig({ ...config, verifier: verifier as RunConfig["verifier"], scenarioId: null })} />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50/70 px-5 py-3">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex flex-wrap gap-1.5">
                {metadata.formats.map((item) => <button key={item.id} aria-pressed={config.format === item.id} onClick={() => setConfig({ ...config, format: item.id, scenarioId: null })} className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${config.format === item.id ? "border-ink bg-ink text-white" : "border-slate-300 bg-white text-slate-600 hover:border-slate-400"}`}>{item.name}</button>)}
              </div>
              <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600">
                <span lang={locale}>{t("fault")}</span>
                <select value={config.tamper ?? ""} onChange={(event) => setConfig({ ...config, tamper: (event.target.value || null) as RunConfig["tamper"], scenarioId: null })} className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs text-ink shadow-xs">
                  {tamperOptions.map((item) => <option key={item.value ?? "none"} value={item.value ?? ""}>{item.label}</option>)}
                </select>
              </label>
              {unsupportedReason && <p role="status" className="text-xs font-semibold text-amber-800">{unsupportedReason}</p>}
            </div>
            <div>
              <button lang={locale} disabled={busy || !driverMode || Boolean(unsupportedReason)} onClick={() => void startRun()} className="flex items-center justify-center gap-1.5 rounded-lg bg-issuer px-4 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-blue-600 disabled:cursor-wait disabled:opacity-60"><Play size={14} fill="currentColor" />{busy ? t("starting") : config.wallet === "inji_web_assisted" ? t("fixture") : t("run")}</button>
            </div>
          </div>
        </section>

        {startError && <p role="alert" className="text-xs text-red-800">{startError}</p>}
        {config.wallet === "inji_web_assisted" && <p className="text-xs text-amber-900">Live assisted start requires a configured deployment and dedicated account. The backend-assisted journey below supports connected fixtures and configured live runs.</p>}
        {((config.wallet === "inji_web_assisted" && !assistedUnavailable(config)) || run?.config.wallet === "inji_web_assisted") && <ConnectedAssisted key={runId ?? "new"} config={run?.config.wallet === "inji_web_assisted" ? run.config : config} resumeId={run?.config.wallet === "inji_web_assisted" && run.recordKind !== "archived_evidence" ? run.id : null} onRun={setRunId} />}
        {assisted && <AssistedJourneyPanel key={assisted.journey.runId} fixture={assisted} />}
        <section id="live-run" className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-wallet">{run?.recordKind === "archived_evidence" ? "Historical evidence · read only" : "Live run"}</p>
              <h2 ref={runHeading} tabIndex={-1} className="mt-0.5 text-base font-bold">{run ? `Run ${run.id.slice(0, 8)}` : runId ? "Loading selected run…" : "Ready when you are"}</h2>
            </div>
            {format && <div className="flex flex-wrap gap-1.5"><span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700">{format.name}</span><span className="rounded-full bg-green-50 px-2.5 py-0.5 text-xs font-semibold text-green-800 border border-green-200">{format.proofType}</span><span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-800 border border-blue-200">{format.algorithm}</span></div>}
          </div>
          {runError && <p role="alert" className="p-4 text-xs text-red-700">Run unavailable. It may be missing or your session may not have access. No previous result is shown.</p>}
          {runError ? null : !runId ? <div className="grid min-h-48 place-items-center p-6 text-center"><div><ArrowRight className="mx-auto mb-2 text-slate-400" size={28} /><p className="font-semibold text-xs text-slate-700">Start a flow to see the live protocol timeline.</p><p className="mt-0.5 text-xs text-slate-600">Protocol exchanges are sanitized before storage.</p></div></div> : (
            <div className="grid gap-5 p-5 lg:grid-cols-[280px_minmax(0,1fr)]">
              <div>
                <div className={`mb-3 rounded-lg border px-3 py-2 text-xs font-semibold ${run?.status === "passed" ? "border-green-200 bg-green-50 text-ok" : runFinished ? "border-red-200 bg-red-50 text-fail" : "border-blue-200 bg-blue-50 text-issuer"}`} role="status" aria-atomic="true">{runMessage}</div>
                {run && <p className="mb-2 text-xs font-semibold text-slate-700">Evidence: {evidenceLabels[evidenceTier(run)]}</p>}
                {run?.recordKind === "archived_evidence" && <p className="mb-2 rounded-lg border border-blue-200 bg-blue-50 p-2.5 text-xs text-blue-900 leading-relaxed">Committed, sanitized 25 October A1 export. Original run ID and timestamps are preserved; opening this record does not repeat the wallet journey.</p>}
                {run?.evaluation && <p className="mb-2 text-xs text-slate-600">Validation: {run.evaluation.verdict.replaceAll("_", " ")}{run.evaluation.observed.code ? ` · ${run.evaluation.observed.code}` : ""}</p>}
                {typeof verifierDetail === "string" && <p className="mb-2 rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900">Verifier detail: {verifierDetail}</p>}
                {runFinished && run?.config.wallet !== "inji_web_assisted" && run?.status !== "errored" && run?.status !== "cancelled" && <button disabled={busy} onClick={() => void replayRun()} className="mb-2.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 shadow-xs hover:bg-slate-50 disabled:opacity-60">Replay with selected fault</button>}
                {runFinished && run && <div className="mb-3 grid grid-cols-2 gap-1.5 text-center text-xs font-semibold"><a className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-slate-700 shadow-xs hover:bg-slate-50" href={`/api/v1/runs/${run.id}/report?format=md`}>Report · Markdown</a><a className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-slate-700 shadow-xs hover:bg-slate-50" href={`/api/v1/runs/${run.id}/report?format=json`}>Report · JSON</a></div>}
                <RunTimeline steps={steps} selectedStepId={selectedStepId} onSelect={selectStep} />
              </div>
              <div className="min-w-0">{run?.recordKind !== "archived_evidence" && <CaptureCoverage key={runId} runId={runId} exchangeCount={exchanges.length} canImport={Boolean(runFinished) || run?.config.wallet === "inji_web_assisted"} onImported={() => void refresh(runId)} />}<SequenceView runId={runId} exchanges={exchanges} selectedExchangeId={selectedExchangeId} onSelect={selectExchange} /><Inspector exchange={selectedExchange} /></div>
            </div>
          )}
        </section>
        <div id="wallet-evidence">
          <WalletEvidencePanel onOpenManagedRun={selectArchivedRun} archivedRunIds={history.filter(item => item.recordKind === "archived_evidence").map(item => item.id)} />
        </div>
        {archiveError && <p role="alert" className="text-xs text-red-700">Run archive unavailable. <button onClick={() => void refreshArchive()} className="underline">Retry archive</button></p>}
        <div id="run-archive">
          <RunArchive history={history} matrix={matrix} active={archiveView} onActiveChange={setArchiveView} onSelectRun={selectArchivedRun} location={location.state} onLocationChange={location.update} shareHref={location.href} />
        </div>
        <div id="run-comparison">
          <RunComparison a={location.state.compareA} b={location.state.compareB} />
        </div>
        <div id="gap-explorer">
          <GapExplorer />
        </div>
      </main>
      <RightSidebar run={run} runId={runId} />
    </div>
  );
}
