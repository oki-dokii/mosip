import { readFile } from "node:fs/promises";
import { realpath, stat } from "node:fs/promises";
import { relative, isAbsolute, resolve } from "node:path";
import fixture from "../../../../spikes/person2-web/local-profile.json" with { type: "json" };

export type LocalProfile = typeof fixture;
const originKeys = ["walletOrigin", "mimotoOrigin", "idpOrigin", "certifyOrigin", "verifyOrigin"] as const;
export function localOrigin(value: unknown): string {
  try {
    if (typeof value !== "string") throw new Error();
    const url = new URL(value);
    if (!["http:", "https:"].includes(url.protocol) || !["127.0.0.1", "localhost", "[::1]"].includes(url.hostname) || url.username || url.password || url.search || url.hash || url.pathname !== "/") throw new Error();
    return url.origin;
  } catch { throw new Error("PERSON2_LOCAL_ORIGIN_INVALID"); }
}
export function validateProfile(value: unknown): LocalProfile {
  const candidate = value as LocalProfile | null;
  if (!candidate || candidate.schemaVersion !== 1 || candidate.recordKind !== "phase1_configuration_fixture" || candidate.integrationReady !== false) throw new Error("PERSON2_PHASE1_PROFILE_INVALID");
  // Return the reviewed public fixture, allowing only explicit loopback origin overrides.
  // Arbitrary JSON fields, credentials and proposed protocol settings are not propagated.
  const origins = Object.fromEntries(originKeys.map(key => [key, localOrigin(candidate[key])])) as Pick<LocalProfile, typeof originKeys[number]>;
  return { ...fixture, ...origins };
}
export async function loadProfile(path?: string): Promise<LocalProfile> {
  try { return validateProfile(path ? JSON.parse(await readFile(path, "utf8")) : fixture); }
  catch { throw new Error("PERSON2_PHASE1_PROFILE_INVALID"); }
}

// Read only an existing synthetic passcode. Never generate/reset it, print it,
// place it in environment variables, or write browser storage/auth snapshots.
export async function readSyntheticPasscode(path: string, repositoryRoot: string): Promise<string> {
  try {
    const actual = await realpath(path);
    const root = await realpath(repositoryRoot);
    const fromRoot = relative(root, actual);
    if (!fromRoot || (!fromRoot.startsWith(".." + (process.platform === "win32" ? "\\" : "/")) && !isAbsolute(fromRoot))) throw new Error();
    const info = await stat(actual);
    if (!info.isFile() || info.size > 16 || (process.platform !== "win32" && (info.mode & 0o077) !== 0) || (process.getuid && info.uid !== process.getuid())) throw new Error();
    const pin = (await readFile(resolve(actual), "utf8")).trim();
    if (!/^\d{6}$/.test(pin)) throw new Error();
    return pin;
  } catch { throw new Error("PERSON2_PRIVATE_SYNTHETIC_PASSCODE_UNAVAILABLE"); }
}
