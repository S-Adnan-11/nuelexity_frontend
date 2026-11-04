import { createContext, useContext, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase/client";
import { clearPrivateNavigation } from "../lib/profile";

const AuthContext = createContext<{
  session: Session | null;
  loading: boolean;
  error: string | null;
  signingOut: boolean;
  signOut: () => Promise<boolean>;
}>({ session: null, loading: true, error: null, signingOut: false, signOut: async () => false });
export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);
  const pendingSignOut = useRef(false);
  const identity = useRef<string | null>(null);
  async function signOut() {
    if (!supabase || pendingSignOut.current) return false;
    pendingSignOut.current = true;
    setSigningOut(true); // Unmount the workspace before the network action; abort its work.
    setError(null);
    clearPrivateNavigation(identity.current);
    try {
      const { error } = await supabase.auth.signOut({ scope: "local" });
      if (error) throw error;
      setSession(null);
      return true;
    } catch {
      setError(identity.current === null
        ? "This browser was signed out, but server revocation could not be confirmed. Previously issued tokens may remain usable until expiry."
        : "Sign-out could not be confirmed. Your session may still be active. Check your connection and try again.");
      return false;
    } finally {
      pendingSignOut.current = false;
      setSigningOut(false);
    }
  }
  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    let active = true;
    let authRevision = 0;
    const restoreTimer = setTimeout(() => {
      if (!active) return;
      authRevision++;
      setSession(null);
      setError("Session restoration timed out. Reload or sign in again.");
      setLoading(false);
    }, 12000);
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, next) => {
      if (active) {
        clearTimeout(restoreTimer);
        if (identity.current && identity.current !== next?.user.id) clearPrivateNavigation(identity.current);
        identity.current = next?.user.id ?? null;
        authRevision++;
        setSession(next);
        setError(null);
        setLoading(false);
      }
    });
    const restoreRevision = authRevision;
    supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (active && authRevision === restoreRevision) {
          clearTimeout(restoreTimer);
          identity.current = data.session?.user.id ?? null;
          setSession(data.session);
          setError(error ? "We couldn't restore your session. Please sign in again." : null);
          setLoading(false);
        }
      })
      .catch(() => {
        if (active && authRevision === restoreRevision) {
          clearTimeout(restoreTimer);
          setError("Sign-in is temporarily unavailable.");
          setLoading(false);
        }
      });
    return () => {
      active = false;
      clearTimeout(restoreTimer);
      subscription.unsubscribe();
    };
  }, []);
  return (
    <AuthContext.Provider value={{ session, loading, error, signingOut, signOut }}>{children}</AuthContext.Provider>
  );
}
export const useAuth = () => useContext(AuthContext);
