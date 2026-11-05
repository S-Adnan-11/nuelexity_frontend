import { useEffect, useRef } from "react";
import { TURNSTILE_SITE_KEY } from "@/lib/config";

interface TurnstileApi {
  render(
    container: HTMLElement,
    options: {
      sitekey: string;
      action: string;
      theme: string;
      retry: "never";
      "refresh-expired": "never";
      "refresh-timeout": "never";
      callback: (token: string) => void;
      "expired-callback": () => void;
      "error-callback": () => boolean;
      "timeout-callback": () => void;
    },
  ): string;
  remove(id: string): void;
}
declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}
let scriptPromise: Promise<void> | undefined;
function load() {
  if (window.turnstile) return Promise.resolve();
  scriptPromise ??= new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    script.async = true;
    const fail = () => {
      clearTimeout(timer);
      script.onload = script.onerror = null;
      script.remove();
      scriptPromise = undefined;
      reject(new Error("The security check couldn’t load. Check your connection and retry verification."));
    };
    const timer = setTimeout(fail, 15000);
    script.onload = () => { if (!window.turnstile) return fail(); clearTimeout(timer); resolve(); };
    script.onerror = fail;
    document.head.appendChild(script);
  });
  return scriptPromise;
}
export function Turnstile({
  onToken,
  onError,
  resetKey,
}: {
  onToken: (token: string) => void;
  onError: (message: string) => void;
  resetKey: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!TURNSTILE_SITE_KEY) return;
    let active = true,
      id: string | undefined;
    load()
      .then(() => {
        if (!active || !ref.current || !window.turnstile) return;
        id = window.turnstile.render(ref.current, {
          sitekey: TURNSTILE_SITE_KEY,
          action: "search",
          theme: "dark",
          retry: "never",
          "refresh-expired": "never",
          "refresh-timeout": "never",
          callback: token => { if (active) onToken(token); },
          "expired-callback": () => { if (active) onToken(""); },
          "error-callback": () => {
            if (active) onError("The security challenge failed. Please retry verification.");
            return true;
          },
          "timeout-callback": () => { if (active) onError("The security challenge timed out. Please retry verification."); },
        });
      })
      .catch((error) => {
        if (active) onError((error as Error).message);
      });
    return () => {
      active = false;
      if (id) window.turnstile?.remove(id);
    };
  }, [onToken, onError, resetKey]);
  return <div ref={ref} className="bot-check" />;
}
