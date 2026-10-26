import gaps from "../../../../submission/gaps.json";

const titles: Record<string, string> = {
  "G-01": "Issuer key representation changes Verify's SD-JWT result",
  "G-02": "Real-wallet validation and remaining profile limits",
  "G-03": "Collab deployment versions are not discoverable",
  "G-04": "Certify credential request returns 401 after a successful token exchange",
  "G-05": "Verify 0.18.2 sample database seed breaks direct-post",
  "G-06": "Verify 0.18.2 accepts mismatched holder challenges in a local probe",
  "G-08": "External ecosystem evaluation remains unexecuted",
  "G-09": "Issuer and wallet JWT proof versions differ",
  "G-10": "Local issuer DID assertion relationship needs an adapter",
  "G-07": "Verify 0.18.2 accepts a descriptor path outside the VP array",
};

const statusLabels: Record<string, string> = {
  observed_wallet_chains_remaining_limits: "Observed wallet chains; limits remain",
  external_profile_evaluation: "Research only",
  reproduced_version_compatibility_difference: "Reproduced version difference",
  observed_did_relationship_mismatch: "Observed local metadata mismatch",
  observed_profile_mismatch: "Observed profile mismatch",
  wallet_capability_or_test_blocker: "Capability or test blocker",
  version_discovery_gap: "Reproducibility gap",
  investigative_deployment_behavior: "Under investigation",
  confirmed_local_release_packaging_mismatch: "Reproduced locally",
  reproduced_local_verifier_binding_gap: "Reproduced locally",
  reproduced_local_descriptor_mapping_gap: "Reproduced locally",
};

function evidenceUrl(path: string): string {
  return `https://github.com/oki-dokii/mosip/blob/main/${path.split("/").map(encodeURIComponent).join("/")}`;
}

export function GapExplorer() {
  return (
    <section aria-labelledby="gap-explorer-heading" className="mt-7 rounded-3xl border border-slate-200 bg-white p-6 shadow-card lg:p-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-issuer">Interoperability findings</p>
          <h2 id="gap-explorer-heading" className="mt-1 text-xl font-bold">What the evidence has revealed</h2>
        </div>
        <a className="text-sm font-semibold text-issuer underline" href={evidenceUrl("docs/GAPS.md")} target="_blank" rel="noreferrer">Read full gap register</a>
      </div>
      <p className="mt-3 max-w-3xl text-sm text-slate-600">These are observed behaviors and test limits, not confirmed upstream defects. An unreported service version or missing wallet account cannot establish a product regression.</p>
      <ul className="mt-5 grid gap-4 md:grid-cols-2">
        {gaps.findings.map((finding) => (
          <li key={finding.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-lg bg-ink px-2 py-1 font-mono text-xs font-bold text-white">{finding.id}</span>
              <span className="text-xs font-semibold text-amber-800">{statusLabels[finding.status] ?? "Investigative finding"}</span>
            </div>
            <h3 className="mt-3 font-bold text-ink">{titles[finding.id] ?? "Interoperability observation"}</h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">{finding.matrixDecision}</p>
            <p className="mt-3 text-xs text-slate-500">Deployment version: {finding.productVersion}</p>
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs font-semibold">
              {finding.evidence.slice(0, 2).map((path) => <a key={path} className="text-issuer underline" href={evidenceUrl(path)} target="_blank" rel="noreferrer">{path.split("/").at(-1)}</a>)}
            </div>
          </li>
        ))}
      </ul>
      <p className="mt-4 text-xs text-slate-500">Source: committed synthetic and sanitized evidence, updated {gaps.updated}. No upstream issue has been filed from this register.</p>
    </section>
  );
}
