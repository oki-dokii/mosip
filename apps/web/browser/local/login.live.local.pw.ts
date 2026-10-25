import { test, expect } from "@playwright/test";
import { resolve } from "node:path";
import { loadProfile, readSyntheticPasscode } from "./profile";
import { loginAndUnlock, restrictToLocalProfile } from "./helpers";

test("opt-in local shell: existing synthetic wallet unlocks in two independent sessions", async ({ browser }) => {
  test.skip(process.env.PERSON2_LOCAL_LIVE !== "1", "Opt-in only; fixture tests require no Docker or wallet.");
  const path = process.env.PERSON2_SYNTHETIC_PASSCODE_FILE;
  if (!path) throw new Error("PERSON2_PRIVATE_SYNTHETIC_PASSCODE_UNAVAILABLE");
  const profile = await loadProfile(process.env.PERSON2_LOCAL_PROFILE_FILE);
  const pin = await readSyntheticPasscode(path, resolve(import.meta.dirname, "../../../.."));
  for (let session = 0; session < 2; session++) {
    const context = await browser.newContext({ serviceWorkers: "block" });
    try {
      await restrictToLocalProfile(context, profile);
      expect((await loginAndUnlock(await context.newPage(), profile, pin)).homeVisible).toBe(true);
    } finally { await context.close(); }
  }
  // Shell check only. Does not issue/present or create an A1 result.
});
