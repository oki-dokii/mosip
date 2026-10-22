import { expect, it } from "vitest";
import { withExchangeLock } from "./exchangeLock.js";
it("serializes sequence allocation and releases failed writers", async () => {
  const repository = {}; let seq = 0; const seen: number[] = [];
  await Promise.all(Array.from({ length: 20 }, () => withExchangeLock(repository, "run", async () => { const next = seq + 1; await Promise.resolve(); seq = next; seen.push(next); })));
  expect(new Set(seen).size).toBe(20);
  await expect(withExchangeLock(repository, "run", async () => { throw new Error("write failed"); })).rejects.toThrow("write failed");
  expect(await withExchangeLock(repository, "run", async () => ++seq)).toBe(21);
});
