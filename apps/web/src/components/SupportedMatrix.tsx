import { useEffect, useState } from "react";
interface Cell { config: Record<string, string>; status: string; testedAt: string | null; evidence: string; runId: string | null }
export function SupportedMatrix() {
  const [cells, setCells] = useState<Cell[] | null>(null);
  useEffect(() => { let stopped = false; void fetch("/api/v1/matrix/cells").then(async response => { if (!response.ok) throw new Error(); return response.json(); }).then(value => { if (!stopped && Array.isArray(value.items)) setCells(value.items); }).catch(() => {}); return () => { stopped = true; }; }, []);
  return <section aria-label="Supported combinations" className="m-5 space-y-2"><h3 className="font-bold">Supported combinations · server-reported coverage</h3>{!cells ? <p>Matrix contract unavailable.</p> : <ul>{cells.map((cell, index) => <li key={index} className="border-b p-2 text-sm"><strong>{Object.values(cell.config).join(" → ")}: {cell.status}</strong><p>Tested: {cell.testedAt ?? "Never tested"} · Evidence: {cell.evidence}</p></li>)}</ul>}</section>;
}
