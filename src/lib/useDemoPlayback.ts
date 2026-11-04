import { useEffect, useRef, useState } from "react";
import { demoCompletedAt, demoDuration } from "./product-demo";
import { useVisibleMotion } from "./useVisibleMotion";

export function useDemoPlayback() {
  const { ref, active, reduced } = useVisibleMotion<HTMLElement>();
  const elapsed = useRef(0);
  const [time, setTime] = useState(demoCompletedAt);
  useEffect(() => {
    if (reduced) { setTime(demoCompletedAt); return; }
    setTime(elapsed.current);
    if (!active) return;
    let request = 0, last = performance.now();
    const tick = (now: number) => {
      elapsed.current = (elapsed.current + now - last) % demoDuration;
      last = now;
      setTime(elapsed.current);
      request = requestAnimationFrame(tick);
    };
    request = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(request);
  }, [active, reduced]);
  return { ref, elapsed: time, playing: active, reduced };
}
