import { useEffect, useState, useSyncExternalStore } from "react";
import { actionUrl, type AssistedActions } from "../lib/assistedActions";
import { createAssistedFixture } from "../lib/assistedFixture";
import { activeStages, type JourneyStage } from "../lib/assistedJourney";

const instructions: Record<JourneyStage, string> = {
  idle: "Start a fixture run to rehearse the assisted JSON-LD journey.",
  starting: "Preparing the assisted fixture run…",
  issuance: "In a live run, open Inji Web, log in with the dedicated test account and accept the credential. Waiting for issuance evidence.",
  storage: "Issuance was observed. Wallet storage is still unconfirmed; HTTP capture alone cannot establish storage.",
  presentation: "Storage confirmation received. Present the JSON-LD credential using the verifier request. Waiting for presentation evidence.",
  result: "Presentation was observed. Waiting for the normalized Inji Verify result.",
  complete: "Fixture journey complete. This is simulated evidence and does not satisfy A1.",
  cancelled: "Assisted fixture run cancelled.",
  timeout: "Observation deadline reached. Verification was not established.",
  error: "The observation source encountered an error.",
};
const button = "rounded-lg border border-slate-400 bg-white px-4 py-2 text-sm font-semibold text-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-700";

export function AssistedJourneyPanel({ fixture, actions = fixture.actions }: { fixture: ReturnType<typeof createAssistedFixture>; actions?: AssistedActions }) {
  const { journey } = fixture;
  const state = useSyncExternalStore(journey.subscribe, journey.getSnapshot);
  const [now, setNow] = useState(Date.now());
  const active = activeStages.includes(state.stage);
  useEffect(() => {
    journey.start(); journey.ready();
  }, [journey]);
  useEffect(() => {
    setNow(Date.now());
    if (!active) return;
    const timer = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, [active, state.deadline]);
  return <section aria-label="Assisted Inji Web fixture journey" className="mt-7 space-y-4 rounded-3xl border border-blue-200 bg-blue-50 p-6">
    <h2 className="text-xl font-bold">Inji Web Assisted · JSON-LD</h2>
    <p className="font-semibold">Fixture simulation · A1 blocked: managed live validation and integrator review pending. A dedicated account and manual wallet success are recorded below.</p>
    <p className="text-sm">Run {state.runId}. These controls inject synthetic observations. No wallet is contacted and no credential or login state is stored.</p>
    <div role="status" aria-live="polite" aria-atomic="true">
      <p className="font-semibold">{instructions[state.stage]}</p>
      {state.message && <p>{state.message}</p>}
      {state.outcome && <p>Simulated verifier result: <strong>{state.outcome}</strong></p>}
    </div>
    {active && state.deadline !== null && <p role="timer" aria-label="Time remaining" className="text-sm">Time remaining: {Math.max(0, Math.ceil((state.deadline - now) / 1000))} seconds</p>}
    {(["issuance", "presentation"] as JourneyStage[]).includes(state.stage) && <nav aria-label="Wallet journey actions" className="flex flex-wrap gap-3">
      {(state.stage === "issuance" ? [["Open wallet", actions.walletUrl], ["Open credential offer", actions.offerUrl]] : [["Open verifier request / same-device link", actions.presentationUrl]]).map(([label, value]) => {
        const href = actionUrl(value);
        return href ? <a key={label} className={button} href={href} target={href.startsWith("https:") ? "_blank" : undefined} rel="noopener noreferrer">{label}</a> : <span key={label} className="text-sm">{label}: unavailable</span>;
      })}
    </nav>}
    {state.stage === "issuance" && <p className="text-sm">Live wallet and credential-offer links are unavailable until the endpoint and account are configured.</p>}
    {state.stage === "issuance" && <div className="space-y-3 text-sm">
      <section id={`${fixture.target}-wallet`} tabIndex={-1}><h3 className="font-semibold">Fixture wallet instructions</h3><p>In a live journey, this action opens Inji Web for account login. This fixture contains no account or credential.</p></section>
      <section id={`${fixture.target}-offer`} tabIndex={-1}><h3 className="font-semibold">Fixture credential offer</h3><p>Issuer: Inji Certify · format: JSON-LD · credential: FarmerCredential. This synthetic offer cannot issue a real VC.</p></section>
    </div>}
    {state.stage === "presentation" && <section id={`${fixture.target}-request`} tabIndex={-1} className="text-sm"><h3 className="font-semibold">Fixture verifier request</h3><p>Verifier: Inji Verify · format: JSON-LD · response mode: direct_post. The fixture action opens this request summary; it is not a usable live QR or same-device link.</p></section>}
    <div className="flex flex-wrap gap-3">
      {state.stage === "issuance" && <button className={button} onClick={fixture.issuance}>Simulate issuance observation</button>}
      {state.stage === "storage" && <button className={button} onClick={fixture.storage}>Simulate wallet storage confirmation</button>}
      {state.stage === "presentation" && <button className={button} onClick={fixture.presentation}>Simulate presentation observation</button>}
      {state.stage === "result" && <><button className={button} onClick={() => fixture.result("valid")}>Simulate valid verifier result</button><button className={button} onClick={() => fixture.result("invalid")}>Simulate invalid verifier result</button></>}
      {active && <><button className={button} onClick={() => journey.cancel()}>Cancel assisted run</button><button className={button} onClick={() => journey.fail()}>Simulate observation error</button></>}
    </div>
  </section>;
}
