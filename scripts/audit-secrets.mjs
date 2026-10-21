#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const allowedPublicEmails = new Set(["decode@mosip.io"]);
const unsafeName = /(?:^|\/)(?:\.env(?:\.(?!example$|sample$)[^/]*)?|[^/]*\.har|[^/]*\.(?:pem|key|p12|pfx)|[^/]*postman[^/]*environment[^/]*|[^/]*(?:student|college)[_-]?id[^/]*)$/i;

export function shouldScanContents(path) {
  const textFile = /\.(?:md|jsonl?|txt|csv|ya?ml|har|xml|properties)$/i.test(path);
  return textFile && (path.endsWith(".md") || path.startsWith("submission/evidence/") ||
    path.startsWith("spikes/fixtures/") || path.startsWith("docs/"));
}

export function scanText(contents) {
  const findings = [];
  const lines = contents.split(/\r?\n/);
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const add = (rule) => findings.push({ line: index + 1, rule });
    if (/-----BEGIN (?:RSA |EC |OPENSSH |ENCRYPTED )?PRIVATE KEY-----/.test(line)) add("private-key-block");
    if (/(?<![A-Za-z0-9_-])[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}(?![A-Za-z0-9_-])/.test(line)) add("jwt-like-value");
    if (/(?<![A-Za-z0-9_/-])[A-Za-z0-9_-]{180,}(?![A-Za-z0-9_/-])/.test(line)) add("long-base64url-value");
    else if (/(?<![A-Za-z0-9+/])[A-Za-z0-9+/]{180,}={0,2}(?![A-Za-z0-9+/])/.test(line)) add("long-base64-value");
    if (/openid-credential-offer:\/\/\S{30,}/i.test(line)) add("credential-offer-uri");
    if (/(?<!\w)\+[1-9]\d{9,14}(?!\d)/.test(line)) add("phone-number");
    const emails = line.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) ?? [];
    if (emails.some((email) => !allowedPublicEmails.has(email.toLowerCase()) && !email.toLowerCase().endsWith("@example.com"))) add("email-address");
  }
  return findings;
}

export function scanFilename(path) {
  return unsafeName.test(path) ? [{ line: 0, rule: "sensitive-filename" }] : [];
}

async function main() {
  const paths = execFileSync("git", ["ls-files", "-z", "--cached", "--others", "--exclude-standard"], { cwd: root })
    .toString("utf8").split("\0").filter(Boolean);
  const findings = [];
  for (const path of paths) {
    for (const finding of scanFilename(path)) findings.push({ path, ...finding });
    if (!shouldScanContents(path)) continue;
    const bytes = await readFile(resolve(root, path));
    if (bytes.includes(0)) continue;
    for (const finding of scanText(bytes.toString("utf8"))) findings.push({ path, ...finding });
  }
  if (findings.length) {
    for (const finding of findings) console.error(`${finding.path}:${finding.line}: ${finding.rule}`);
    console.error(`Secret audit found ${findings.length} possible exposure(s). Review locally; values are never printed.`);
    process.exitCode = 1;
  } else {
    console.log(`Secret audit passed: ${paths.length} tracked/non-ignored filenames checked; documentation and evidence text scanned.`);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
