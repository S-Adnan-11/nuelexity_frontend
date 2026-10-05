import { useEffect, useRef } from "react";
import { TURNSTILE_SITE_KEY } from "@/lib/config";

interface TurnstileApi {
  render(
    container: HTMLElement,
    options: {
      sitekey: string;
      action: string;
      theme: string;
      callback: (token: string) => void;
      "expired-callback": () => void;
      "error-callback": () => void;
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
    script.onload = () => resolve();
    script.onerror = () => {
      script.remove();
      scriptPromise = undefined;
      reject(new Error("Verification couldn't load. Try refreshing the page."));
    };
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
          callback: onToken,
          "expired-callback": () => onToken(""),
          "error-callback": () => {
            onToken("");
            onError("Verification failed. Try refreshing the page.");
          },
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
