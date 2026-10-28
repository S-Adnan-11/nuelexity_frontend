import { useEffect, useLayoutEffect, useSyncExternalStore } from "react";
import { backendStartup } from "./api";

export function useBackendStartup() {
  const state = useSyncExternalStore(backendStartup.subscribe, backendStartup.snapshot);
  useLayoutEffect(() => {
    backendStartup.reset();
    return () => backendStartup.stop();
  }, []);
  useEffect(() => {
    let active = true;
    // Effects making existing session/catalogue/history reads claim the operation
    // first. Only an entry without any such read falls back to cheap health.
    queueMicrotask(() => { if (active) void backendStartup.ensure().catch(() => {}); });
    return () => { active = false; };
  }, []);
  return state;
}
