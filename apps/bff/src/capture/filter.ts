import { writeFile, unlink } from "node:fs/promises";
import { createReadStream } from "node:fs";
import { extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { RunSummary } from "@playground/shared";
import { createSteps } from "../orchestrator.js";
import { captureOrigins, prepareHarImport, type CaptureOrigins } from "./har.js";
import { tagCapture } from "./tagging.js";

// All returned bytes are reconstructed from sanitized exchanges. Never copy input entries to output.
function prepareFilteredHar(input: unknown, runId: string, origins: CaptureOrigins) {
  if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(runId)) throw new Error("CAPTURE_FILTER_RUN_ID");
  const raw = input as { har?: { log?: { entries?: unknown } }; log?: { entries?: unknown } } | null;
  const entries = raw?.har?.log?.entries ?? raw?.log?.entries;
  if (!Array.isArray(entries) || entries.length > 20_000) throw new Error("CAPTURE_FILTER_INVALID_HAR");
  const counts: Record<string, number> = {};
  const count = (reason: string) => { counts[reason] = (counts[reason] ?? 0) + 1; };
  const candidates = entries.filter((entry) => {
    if (!entry?.request || typeof entry.request.url !== "string") { count("malformed_entry"); return false; }
    let url: URL;
    try { url = new URL(entry.request.url); } catch { count("malformed_entry"); return false; }
    const service = origins.get(url.origin);
    if (!service || url.username || url.password) { count("background_origin"); return false; }
    if (!tagCapture(service, (typeof entry.request.method === "string" ? entry.request.method : "").toUpperCase(), url.pathname)) { count("untagged"); return false; }
    return true;
  });
  const run: RunSummary = {
    id: runId, parentRunId: null, config: { issuer: "inji_certify", wallet: "inji_web_assisted", verifier: "inji_verify", format: "ldp_vc", flow: "cross_device", tamper: null, scenarioId: null },
    status: "passed", expectedOutcome: "valid", actualOutcome: null, proofType: "unobserved", algorithm: "unobserved", createdAt: new Date(0).toISOString(), startedAt: null, finishedAt: null,
  };
  const record = { run, steps: createSteps(runId), exchanges: [] as ReturnType<typeof prepareHarImport>["exchanges"] };
  for (let index = 0; index < candidates.length; index += 100) {
    const prepared = prepareHarImport({ runId, har: { log: { entries: candidates.slice(index, index + 100) } } }, record, origins);
    record.exchanges.push(...prepared.exchanges);
    for (const [reason, n] of Object.entries(prepared.skippedReasons)) counts[reason] = (counts[reason] ?? 0) + n;
  }
  const sanitized = record.exchanges.map((exchange) => {
    const req = exchange.request as { headers: Record<string, string>; body: unknown; capture: { observedAt: string; timingKnown: boolean } };
    const res = exchange.response as { headers: Record<string, string>; body: unknown; capture: { observedAt: string; timingKnown: boolean } };
    const headerList = (headers: Record<string, string>) => Object.entries(headers).map(([name, value]) => ({ name, value }));
    return {
      startedDateTime: req.capture.observedAt, time: req.capture.timingKnown ? exchange.durationMs : -1,
      request: { method: exchange.method, url: exchange.url, headers: headerList(req.headers), postData: { mimeType: "application/json", text: JSON.stringify(req.body) } },
      response: { status: exchange.status, headers: headerList(res.headers), content: { mimeType: "application/json", text: JSON.stringify(res.body) } },
    };
  }).sort((a, b) => a.startedDateTime.localeCompare(b.startedDateTime));
  const views = record.exchanges.map((exchange) => ({ request: (exchange.request as Record<string, unknown>).publicView, response: (exchange.response as Record<string, unknown>).publicView }));
  const chunkCount = Math.max(1, Math.ceil(sanitized.length / 100));
  const results = Array.from({ length: chunkCount }, (_, index) => {
    const start = index * 100;
    const chunk = sanitized.slice(start, start + 100);
    const result = { runId, har: { log: { version: "1.2", creator: { name: "playground-safe-filter", version: "1" }, entries: chunk } },
      report: { source: "synthetic_har_local_filter", inputEntries: entries.length, outputEntries: chunk.length, skippedReasons: counts,
        chunkIndex: index + 1, chunkCount,
        publicViews: views.slice(start, start + 100),
        note: "Bodies were sanitized locally. Skip counts describe the entire source file and repeat in each chunk. Full public projections are in this report; importing the filtered HAR may produce a smaller projection. No live-wallet or cryptographic validity is established." } };
    if (Buffer.byteLength(JSON.stringify(result, null, 2)) + 1 > 2 * 1024 * 1024) throw new Error("CAPTURE_FILTER_SPLIT_REQUIRED");
    return result;
  });
  return results;
}

export function filterHar(input: unknown, runId: string, origins: CaptureOrigins = captureOrigins()) {
  const results = prepareFilteredHar(input, runId, origins);
  if (results.length !== 1) throw new Error("CAPTURE_FILTER_SPLIT_REQUIRED");
  return results[0]!;
}

export function filterHarChunks(input: unknown, runId: string, origins: CaptureOrigins = captureOrigins()) {
  return prepareFilteredHar(input, runId, origins);
}

async function main() {
  try {
    const [input, output, runId, option, extra] = process.argv.slice(2);
    if (!input || !output || !runId || resolve(input) === resolve(output) || (option && option !== "--split") || extra) throw new Error("CAPTURE_FILTER_ARGUMENTS");
    const chunks: Buffer[] = [];
    let size = 0;
    for await (const chunk of createReadStream(input)) {
      size += chunk.length;
      if (size > 32 * 1024 * 1024) throw new Error("CAPTURE_FILTER_TOO_LARGE");
      chunks.push(chunk as Buffer);
    }
    const file = Buffer.concat(chunks);
    const results = option === "--split" ? filterHarChunks(JSON.parse(file.toString("utf8")), runId) : [filterHar(JSON.parse(file.toString("utf8")), runId)];
    const extension = extname(output);
    const paths = results.map((_, index) => option === "--split" && results.length > 1
      ? `${output.slice(0, -extension.length || undefined)}.part-${String(index + 1).padStart(3, "0")}${extension}` : output);
    const created: string[] = [];
    try {
      for (let index = 0; index < results.length; index++) {
        await writeFile(paths[index]!, `${JSON.stringify(results[index], null, 2)}\n`, { flag: "wx", mode: 0o600 });
        created.push(paths[index]!);
      }
    } catch (error) {
      await Promise.all(created.map((path) => unlink(path)));
      throw error;
    }
    console.log(JSON.stringify({ code: "CAPTURE_FILTER_SAVED", inputEntries: results[0]!.report.inputEntries,
      outputEntries: results.reduce((sum, item) => sum + item.report.outputEntries, 0), chunks: results.length,
      skippedReasons: results[0]!.report.skippedReasons }));
  } catch { console.error("CAPTURE_FILTER_FAILED: check arguments, size, HAR shape, output existence, and configured origins locally."); process.exitCode = 1; }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
