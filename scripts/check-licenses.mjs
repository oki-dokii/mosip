import { readFileSync, existsSync } from "node:fs";
import { execSync } from "node:child_process";

const BLOCKED_LICENSES = ["GPL-2.0", "GPL-3.0", "AGPL-3.0", "LGPL-2.1", "GPL", "AGPL"];

let licensesJson;
if (existsSync("artifacts/licenses.json")) {
  licensesJson = JSON.parse(readFileSync("artifacts/licenses.json", "utf8"));
} else {
  const output = execSync("pnpm licenses list --json", { encoding: "utf8" });
  licensesJson = JSON.parse(output);
}

const hits = [];
let totalPackages = 0;

if (Array.isArray(licensesJson)) {
  for (const pkg of licensesJson) {
    totalPackages += 1;
    const lic = pkg.license || "";
    if (BLOCKED_LICENSES.some((b) => lic.toUpperCase().includes(b))) {
      hits.push({ name: pkg.name, version: pkg.version, license: lic });
    }
  }
} else if (typeof licensesJson === "object" && licensesJson !== null) {
  for (const [license, pkgs] of Object.entries(licensesJson)) {
    if (Array.isArray(pkgs)) {
      totalPackages += pkgs.length;
      if (BLOCKED_LICENSES.some((b) => license.toUpperCase().includes(b))) {
        for (const pkg of pkgs) {
          hits.push({ name: pkg.name, versions: pkg.versions, license });
        }
      }
    }
  }
} else {
  console.error("Unknown licenses.json format");
  process.exit(1);
}

if (hits.length > 0) {
  console.error(`FAILED: Found ${hits.length} packages with blocked licenses:`, hits);
  process.exit(1);
}

console.log(`LICENSE AUDIT PASSED: ${totalPackages} packages verified, 0 blocked licenses.`);
