import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { backendStartup, getGuestSession, verifyGuestChallenge } from "./api";
import { withAbort } from "./startup";
import { guestPassStore } from "./guest-pass";

export function useGuestSession(enabled: boolean) {
  const [ready, setReady] = useState(false);
  const [checking, setChecking] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<number | null>(null);
  const [revision, setRevision] = useState(0);
  const verification = useRef<AbortController | null>(null);
  const active = useRef(enabled);
  useLayoutEffect(() => {
    active.current = enabled;
    return () => { active.current = false; verification.current?.abort(); };
  }, [enabled]);
  const lastToken = useRef("");
  const recheck = useCallback(() => setRevision(value => value + 1), []);

  const reset = useCallback(() => {
    verification.current?.abort();
    verification.current = null;
    guestPassStore.clear();
    setReady(false);
    setChecking(true);
    setVerifying(false);
    setExpiresAt(null);
    setRevision((value) => value + 1);
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    if (!enabled) {
      setReady(false);
      setChecking(true);
      setExpiresAt(null);
      setVerifying(false);
      setError(null);
      return;
    }
    setChecking(true);
    setVerifying(false);
    setError(null);
    void getGuestSession(controller.signal)
      .then((session) => {
        if (controller.signal.aborted) return;
        setReady(session.verified || !session.verificationRequired);
        setExpiresAt(session.expiresAt);
      })
      .catch((failure: Error) => {
        if (!controller.signal.aborted) {
          setReady(false);
          setError(failure.message);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setChecking(false);
      });
    return () => controller.abort();
  }, [enabled, revision]);
  useEffect(() => {
    if (!enabled || !ready || expiresAt === null) return;
    const timer = setTimeout(reset, Math.max(0, expiresAt - Date.now()));
    return () => clearTimeout(timer);
  }, [enabled, ready, expiresAt, reset]);
  useEffect(
    () => () => {
      verification.current?.abort();
      verification.current = null;
    },
    [enabled],
  );

  const verify = useCallback(
    (token: string) => {
      if (!active.current) return;
      if (!token) {
        verification.current?.abort();
        verification.current = null;
        setVerifying(false);
        setError("Verification expired. Please verify again.");
        setRevision(value => value + 1);
        return;
      }
      if (!enabled || verification.current || token === lastToken.current) return;
      lastToken.current = token; // A single-use proof never enters a retry loop.
      const receivedAt = Date.now();
      const controller = new AbortController();
      verification.current = controller;
      setVerifying(true);
      setError(null);
      void withAbort(backendStartup.ensure(), controller.signal)
        .then(() => {
          if (Date.now() - receivedAt > 240000) throw new Error("Verification expired. Please verify again.");
          return verifyGuestChallenge(token, AbortSignal.any([controller.signal, AbortSignal.timeout(10000)]));
        })
        .then((expiry) => {
          if (controller.signal.aborted) return;
          setExpiresAt(expiry);
          setReady(true);
        })
        .catch((failure: Error) => {
          if (!controller.signal.aborted) {
            guestPassStore.clear();
            setReady(false);
            setExpiresAt(null);
            setError(failure.message);
          }
        })
        .finally(() => {
          if (verification.current === controller) {
            verification.current = null;
            setVerifying(false);
          }
        });
    },
    [enabled, reset],
  );
  return {
    ready,
    checking,
    verifying,
    error,
    verify,
    reset,
    recheck,
    resetKey: revision,
    onError: setError,
  };
}
