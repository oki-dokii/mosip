import type { Exchange } from "@playground/shared";

function safeLabel(value: string) {
  return value.replaceAll("\n", " ").replaceAll('"', "'");
}

export function buildSequence(exchanges: Exchange[]) {
  const actors = [...new Set(exchanges.flatMap((item) => [item.actorFrom, item.actorTo]))];
  const aliases = new Map(actors.map((actor, index) => [actor, `actor${index + 1}`]));
  const lines = ["sequenceDiagram", ...actors.map((actor) => `  participant ${aliases.get(actor)} as ${safeLabel(actor)}`)];
  const markers: Array<{ exchangeId: string; stepId: string; line: number }> = [];
  for (const item of exchanges) {
    markers.push({ exchangeId: item.id, stepId: item.stepId, line: lines.length + 1 });
    const label = safeLabel(`${item.method} ${item.url} [${item.status}]`);
    lines.push(`  ${aliases.get(item.actorFrom)}->>${aliases.get(item.actorTo)}: ${label}`);
  }
  return { mermaid: lines.join("\n"), markers };
}
