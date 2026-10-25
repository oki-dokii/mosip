import { useEffect, useLayoutEffect, useRef } from "react";

/** Recover focus only when this region removes the user's focused control. */
export function useFocusRecovery() {
  const root = useRef<HTMLElement>(null);
  const fallback = useRef<HTMLHeadingElement>(null);
  const focused = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const remember = (event: FocusEvent) => {
      const target = event.target;
      focused.current = target instanceof HTMLElement && root.current?.contains(target) ? target : null;
    };
    document.addEventListener("focusin", remember);
    return () => document.removeEventListener("focusin", remember);
  }, []);
  useLayoutEffect(() => {
    if (focused.current && !focused.current.isConnected && document.activeElement === document.body) fallback.current?.focus({ preventScroll: true });
  });
  return { root, fallback };
}
