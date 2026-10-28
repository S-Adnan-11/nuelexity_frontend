import { useEffect, useRef, useState } from "react";

export function useVisibleMotion<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [state, setState] = useState({ visible: false, foreground: true, reduced: true });
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let visible = false;
    const sync = () => setState({ visible, foreground: !document.hidden, reduced: motion.matches });
    const observer = new IntersectionObserver(entries => { visible = entries.some(entry => entry.isIntersecting); sync(); });
    observer.observe(node);
    motion.addEventListener("change", sync);
    document.addEventListener("visibilitychange", sync);
    sync();
    return () => {
      observer.disconnect(); motion.removeEventListener("change", sync);
      document.removeEventListener("visibilitychange", sync);
    };
  }, []);
  return { ref, reduced: state.reduced, active: state.visible && state.foreground && !state.reduced };
}
