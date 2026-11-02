const release = "https://github.com/oki-dokii/mosip/blob/final-2026-11-02";

export function AndroidWalletGuide() {
  return <main className="min-h-screen bg-canvas px-5 py-8 text-ink">
    <div className="mx-auto max-w-3xl space-y-6">
      <nav aria-label="Playground"><a className="font-semibold text-issuer underline" href="/">← Back to playground</a></nav>
      <header><p className="text-sm font-semibold text-issuer">Real wallet testing</p>
        <h1 className="mt-1 text-3xl font-bold">Android wallet verification</h1>
        <p className="mt-2">Use Inji Wallet on a phone to store and present a synthetic SD-JWT.</p>
      </header>
      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-lg font-bold">Recorded journey · Collab Verify</h2>
        <p className="mt-2">On 23 October, local Certify issued the card to a Nothing Phone (2a). It survived reopening the wallet, and Collab Verify returned Valid with both proof checks passing. This manual run has no playground run ID.</p>
        <a className="mt-3 inline-block font-semibold text-issuer underline" href={release+"/submission/A2_MOBILE_EVIDENCE.md"}>Inspect Android evidence</a>
      </section>
      <section className="rounded-xl border border-amber-300 bg-white p-5">
        <h2 className="text-lg font-bold">Local Verify · awaiting a managed run</h2>
        <p className="mt-2">The playground currently has no Android driver to create a run ID and local presentation QR. The existing phone console sends presentations to Collab Verify.</p>
        <h3 className="mt-5 font-bold">Operator checklist once the driver is available</h3>
        <ol className="mt-2 list-decimal space-y-2 pl-6">
          <li>Check that the phone trusts and can reach both local services over HTTPS. Start the Android run and note its ID.</li>
          <li>Scan the local Certify offer. Download Playground SD-JWT Identity, reopen the wallet and confirm the same card is present.</li>
          <li>Use Share to scan the local Verify request from that run. Select the stored card and approve sharing.</li>
          <li>Read the independent local Verify result for that run. A pass requires Valid and both credential and holder proof checks to be true.</li>
        </ol>
        <p className="mt-4 text-sm text-slate-700">If a step fails, record the step, error and component versions. Keep QR contents, credentials and tokens out of the report.</p>
        <a className="mt-3 inline-block font-semibold text-issuer underline" href={release+"/deploy/MOBILE_INJI.md"}>Open the existing Collab phone console instructions</a>
      </section>
    </div>
  </main>;
}
