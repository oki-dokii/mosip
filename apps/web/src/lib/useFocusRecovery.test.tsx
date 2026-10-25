// @vitest-environment jsdom
import React from "react";
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { useFocusRecovery } from "./useFocusRecovery";
function Region({ visible }: { visible: boolean }) {
  const focus = useFocusRecovery();
  return <><section ref={focus.root}><h2 ref={focus.fallback} tabIndex={-1}>Journey checkpoint</h2>{visible && <button>Next observation</button>}</section><button>Outside</button></>;
}
afterEach(cleanup);
it("recovers keyboard focus when a checkpoint removes its action", () => {
  const { rerender } = render(<Region visible />);
  act(() => screen.getByRole("button", { name: "Next observation" }).focus());
  rerender(<Region visible={false} />);
  expect(document.activeElement).toBe(screen.getByRole("heading"));
});
it("does not steal focus when the user moved outside the region", () => {
  const { rerender } = render(<Region visible />);
  act(() => { screen.getByRole("button", { name: "Next observation" }).focus(); screen.getByRole("button", { name: "Outside" }).focus(); });
  rerender(<Region visible={false} />);
  expect(document.activeElement).toBe(screen.getByRole("button", { name: "Outside" }));
});
it("does not refocus a surviving control on polling renders", () => {
  const { rerender } = render(<Region visible />);
  const action = screen.getByRole("button", { name: "Next observation" });
  act(() => action.focus()); rerender(<Region visible />);
  expect(document.activeElement).toBe(action);
});
