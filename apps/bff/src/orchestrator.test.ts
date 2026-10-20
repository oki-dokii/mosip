import { describe, expect, it } from "vitest";
import { createSteps } from "./orchestrator.js";

describe("walking-skeleton orchestration", () => {
  it("creates the ordered issue-to-verify timeline", () => {
    const steps = createSteps("run-1");

    expect(steps.map((step) => step.stepKey)).toEqual([
      "INIT",
      "ISSUE_OFFER",
      "ISSUE_TOKEN",
      "ISSUE_CREDENTIAL",
      "STORE",
      "PRESENT_REQUEST",
      "PRESENT_SUBMIT",
      "PRESENT_RESULT",
      "REPORT",
    ]);
    expect(steps.every((step) => step.status === "pending")).toBe(true);
  });
});
