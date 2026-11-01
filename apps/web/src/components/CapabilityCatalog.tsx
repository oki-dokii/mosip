import { useEffect, useState } from "react";
import qr from "../data/qr.json";

type Party = { id: string; name: string; role: string; endpoint: string; formats: string[]; flows: string[]; evidenceTier: string; evidence: string | null };
const list = (x: unknown) => Array.isArray(x) && x.every(s => typeof s === "string");
export function parseRegistry(value: unknown): Party[] {
  const doc = value as {schemaVersion?: number; parties?: Party[]} | null;
  const ids = new Set<string>();
  if (doc?.schemaVersion !== 1 || !Array.isArray(doc.parties)) throw Error("Invalid registry");
  for (const p of doc.parties) {
    if (!p || typeof p.id !== "string" || !/^[a-z][a-z0-9-]*$/.test(p.id) || ids.has(p.id) ||
      !["issuer","wallet","verifier"].includes(p.role) || typeof p.name !== "string" || !p.name.trim() ||
      !list(p.formats) || !list(p.flows) || !p.flows.length || typeof p.evidenceTier !== "string" ||
      !(p.evidence === null ? p.evidenceTier === "registered only" : typeof p.evidence === "string" && /^(submission|artifacts|spikes)\/[\w/-]+\.json$/.test(p.evidence))) throw Error("Invalid party");
    const url = new URL(p.endpoint);
    if (!(url.protocol === "https:" || (url.protocol === "http:" && ["127.0.0.1","localhost"].includes(url.hostname))) ||
        url.username || url.password || url.search || url.hash) throw Error("Invalid public endpoint");
    ids.add(p.id);
  }
  return doc.parties;
}

export function CapabilityCatalog({ capacities }: { capacities: boolean }) {
  const [parties, setParties] = useState<Party[]>();
  const [failed, setFailed] = useState(false);
  const [role, setRole] = useState("all");
  useEffect(() => {
    const stop = new AbortController();
    fetch("/parties.json", { signal: stop.signal, cache: "no-cache" })
      .then(r => { if (!r.ok) throw Error(); return r.json(); }).then(parseRegistry)
      .then(setParties).catch(() => { if (!stop.signal.aborted) setFailed(true); });
    return () => stop.abort();
  }, []);
  return <main className="mx-auto max-w-6xl space-y-6 p-6">
    <nav aria-label="Playground pages" className="flex gap-5 underline"><a href="/">Playground</a><a href="/parties">Parties</a><a href="/capabilities">QR and capabilities</a></nav>
    <h1 className="text-3xl font-bold">{capacities ? "QR and capabilities" : "Parties"}</h1>
    {capacities && <section className="space-y-3"><h2 className="text-xl font-bold">What fits in one QR?</h2>
      <p>Six synthetic credential shapes, with all disclosures included for SD-JWT. Each entry gives the smallest QR version the encoder produced at error correction M. PixelPass 0.6.0 was decoded back to the original input. These are encoding measurements; phone scanning and wallet acceptance were not tested.</p>
      <div className="overflow-x-auto"><table className="w-full text-left"><caption className="sr-only">Raw and PixelPass encoding measurements</caption><thead><tr>{["Format","Claims","Raw bytes","PixelPass bytes","Raw QR","PixelPass QR"].map(t=><th key={t}>{t}</th>)}</tr></thead>
      <tbody>{qr.map(r=><tr key={r.format+r.claims}>{[r.format,r.claims,r.bytes,r.packedBytes,...[r.rawVersion,r.packedVersion].map(v=>v ? "Version "+v : "Too large")].map((v,i)=><td className="border-b py-2" key={i}>{v}</td>)}</tr>)}</tbody></table></div>
      <p>Base45 can increase byte length but use QR alphanumeric mode more efficiently. A credential embedded in a QR and a QR carrying only a request URL have different capacity requirements.</p></section>}
    <h2 className="text-xl font-bold">{capacities ? "Claimed versus proven" : "Registered implementations"}</h2>
    <p>Formats and flows are configuration. An evidence link identifies the particular run that exercised a party; registration alone does not validate a combination.</p>
    <label>Role <select value={role} onChange={e=>setRole(e.target.value)}>{["all","issuer","wallet","verifier"].map(r=><option key={r}>{r}</option>)}</select></label>
    {failed ? <p role="alert">Party registry could not be loaded or validated.</p> : !parties ? <p role="status">Loading parties…</p> :
    <ul className="grid gap-4 md:grid-cols-2">{parties.filter(p=>role==="all" || p.role===role).map(p=><li key={p.id} className="rounded-xl border p-4">
      <h3 className="font-bold">{p.name}</h3><p>{p.role} · {p.flows.join(", ")}</p><p>Formats: {p.formats.join(", ") || "not declared"}</p>
      <p className="break-all"><code>{p.endpoint}</code></p><p>Evidence: {p.evidenceTier} {p.evidence && <a className="underline" href={"https://github.com/oki-dokii/mosip/blob/main/"+p.evidence}>View run</a>}</p>
    </li>)}</ul>}
  </main>;
}
