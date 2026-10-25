import { useEffect, useState } from "react";
interface Cell { config: Record<string, string>; status: string; testedAt: string | null; evidence: string; runId: string | null; manualEvidenceIds?: string[] }
export function SupportedMatrix() {
  const [cells, setCells] = useState<Cell[] | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => { let stopped = false; void fetch("/api/v1/matrix/cells").then(async response => { if (!response.ok) throw new Error(); return response.json(); }).then(value => { if (!Array.isArray(value.items)) throw new Error(); if (!stopped) setCells(value.items); }).catch(() => { if (!stopped) setError(true); }); return () => { stopped = true; }; }, []);
  return <section aria-label="Supported combinations" className="m-5 space-y-2"><h3 className="font-bold">Supported combinations · server-reported coverage</h3>{error ? <p role="alert">Matrix contract unavailable.</p> : !cells ? <p role="status">Loading supported combinations…</p> : <ul>{cells.map((cell, index) => <li key={index} className="border-b p-2 text-sm"><strong>{Object.values(cell.config).join(" → ")}: {cell.status}</strong><p>Tested: {cell.testedAt ?? "Never tested"} · Evidence: {cell.evidence}</p>{cell.manualEvidenceIds?.map(id => <p key={id}><a className="text-issuer underline" href={`#wallet-evidence-${id}`}>Related manual Web observation: Valid</a> · managed validation remains separate</p>)}</li>)}</ul>}</section>;
}
