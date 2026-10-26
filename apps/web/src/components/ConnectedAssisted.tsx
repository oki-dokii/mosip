import { NativeWalletOptions } from "./NativeWalletOptions";
import { useEffect, useState } from "react";
import type { RunConfig, RunSummary, RunStep } from "@playground/shared";
import { api } from "../lib/api";
import { actionUrl } from "../lib/assistedActions";
import { useFocusRecovery } from "../lib/useFocusRecovery";

export function ConnectedAssisted({ config, onRun, resumeId }: { config: RunConfig; onRun: (id: string) => void; resumeId: string | null }) {
  const focus = useFocusRecovery();
  const [live, setLive] = useState(false);
  const [id, setId] = useState<string | null>(null);
  const [state, setState] = useState<{ run: RunSummary; steps: RunStep[]; actions: Record<string, string>; deadlineAt: number | null } | null>(null);
  useEffect(() => { if (resumeId) { setState(null); setId(resumeId); } }, [resumeId]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { void api.assistedCapabilities().then(value => setLive(value.liveAvailable)).catch(() => setLive(false)); }, []);
  useEffect(() => {
    if (!id) return;
    let stopped = false;
    let timer: number | undefined;
    const update = async () => {
      let again = true;
      try {
        const value = await api.assistedStatus(id);
        if (stopped) return;
        setState(value);
        again = ["pending", "running"].includes(value.run.status);
      } catch { if (!stopped) setMessage("Assisted status unavailable. No verifier verdict can be inferred."); }
      if (!stopped && again) timer = window.setTimeout(() => { void update(); }, 250);
    };
    void update();
    return () => { stopped = true; if (timer !== undefined) window.clearTimeout(timer); };
  }, [id]);
  const active = (id !== null && state === null) || state?.run.status === "pending" || state?.run.status === "running";
  const fixture = state?.run.serviceVersions?.wallet.startsWith("fixture/");
  async function start(mode: "fixture" | "live") {
    setBusy(true); setMessage(""); setState(null);
    try { const result = await api.startAssisted({ ...config, scenarioId: null }, mode); setId(result.runId); onRun(result.runId); }
    catch { setId(null); setMessage("Assisted start rejected. Check supported configuration and deployment availability."); }
    finally { setBusy(false); }
  }
  async function observe(kind: "issuance" | "storage" | "presentation") {
    if (!id) return;
    try { await api.assistedObserve(id, kind); } catch { setMessage("Observation rejected or run already finished. Refresh status before retrying."); }
  }
  const step = state?.steps.find(item => item.status === "running");
  return <section ref={focus.root} aria-label="Connected assisted journey" className="mt-5 space-y-3 rounded-xl border border-blue-300 bg-white p-5">
    <h2 ref={focus.fallback} tabIndex={-1} className="text-lg font-bold">Backend-assisted journey</h2>
    <p>Fixture mode tests the API and observation-driven journey. Live A1 requires a fresh playground-managed wallet run with correlated issuance, storage, presentation and verifier result.</p>
    <div className="flex flex-wrap gap-3"><button disabled={busy || active} onClick={() => void start("fixture")} className="rounded border px-3 py-2">Start connected fixture</button><button disabled={!live || busy || active} onClick={() => void start("live")} className="rounded border px-3 py-2 disabled:opacity-50">Start live assisted run</button></div>
    {!live && <p>Live start unavailable on this deployment. Configure the assisted endpoints and capture bridge before starting a managed wallet run.</p>}
    {message && <p role="alert">{message}</p>}
    {state && <div role="status" aria-atomic="true"><p>Backend run: {state.run.id}</p><p>{fixture ? "Fixture simulation" : "Wallet evidence unverified"} · {state.run.status}</p><p>{step ? `Waiting: ${step.stepKey}` : `Verifier outcome: ${state.run.actualOutcome ?? "not established"}`}</p>{state.steps.filter(item => typeof item.summary?.error === "string").map(item => <p key={item.id}>{String(item.summary?.error)}{typeof item.summary?.upstreamHttpStatus === "number" ? ` · upstream HTTP ${item.summary.upstreamHttpStatus}` : ""}{typeof item.summary?.upstreamErrorCode === "string" ? ` · ${item.summary.upstreamErrorCode}` : ""}</p>)}</div>}
    {active && state?.deadlineAt && <p role="timer" aria-label="Time remaining">Time remaining: {Math.max(0, Math.ceil((state.deadlineAt - Date.now()) / 1000))} seconds</p>}
    {active && <>
      <nav aria-label="Connected wallet actions">{Object.entries(state?.actions ?? {}).map(([label, value]) => { const href = actionUrl(value); return href ? <a key={label} href={href} rel="noopener noreferrer" target={href.startsWith("https:") ? "_blank" : undefined} className="mr-3 underline">{label}</a> : null; })}</nav>
      {!fixture && <NativeWalletOptions presentationUrl={state?.actions.presentationUrl} />}
      {step?.stepKey === "ISSUE_CREDENTIAL" && fixture && <button onClick={() => void observe("issuance")}>Inject fixture issuance</button>}
      {step?.stepKey === "STORE" && <button onClick={() => void observe("storage")}>{fixture ? "Inject fixture storage confirmation" : "Confirm credential visible in persistent wallet"}</button>}
      {step?.stepKey === "PRESENT_SUBMIT" && fixture && <button onClick={() => void observe("presentation")}>Inject fixture presentation</button>}
      <button className="ml-4 underline" onClick={() => { if (id) void api.cancelAssisted(id).catch(() => setMessage("Cancellation unavailable; check run status.")); }}>Cancel backend-assisted run</button>
    </>}
  </section>;
}
