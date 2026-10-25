import { count, object, publicView, type Projection } from "../lib/captureEvidence";
import { publicStructure } from "../lib/publicStructure";

export function ProjectionCounts({ totals }: { totals: Projection }) {
  return <p className="text-sm">Withheld names: {totals.withheldNames} · Truncated items: {totals.truncatedItems} · Unsupported kinds: {totals.unsupportedKinds}</p>;
}
export function PublicEvidence({ value, label }: { value: unknown; label: string }) {
  const envelope = object(value); const view = publicView(envelope?.publicView);
  const capture = object(envelope?.capture);
  const structure = publicStructure(value);
  return <section aria-label={`${label} public evidence`} className="space-y-2">
    <h4 className="font-semibold">Safe public summary</h4>
    {!view ? <p>Public summary unavailable or unsupported.</p> : <>
      <p className="font-semibold text-amber-200">Authenticity: not_verified — decoded metadata is not a verification verdict.</p>
      <ProjectionCounts totals={view} />
      {view.items.length === 0 && <p>{view.unsupportedKinds > 0 ? "Format not decoded" : "No public items projected."}</p>}
      {structure?.items.map((item, index) => <div key={index}><p className="font-semibold">{item.kind}</p><dl className="text-sm">{item.rows.map((row, i) => <div key={i}><dt className="font-semibold">{row.label}</dt><dd className="break-words">{row.values.join(", ")}</dd></div>)}</dl>{!item.rows.length && <p>No displayable claim names or structure in this projection.</p>}</div>)}
    </>}
    {capture?.schemaVersion === 1 && typeof capture.ruleId === "string" && typeof capture.why === "string" && count(capture.redactionCount) !== null && <div className="text-sm">
      <p>Capture rule: {capture.ruleId} · {capture.why}</p><p>Redacted paths: {String(capture.redactionCount)}</p>
      <p>{capture.timingKnown === true ? "Capture timing known" : "Capture timing unknown"}</p>
    </div>}
  </section>;
}
