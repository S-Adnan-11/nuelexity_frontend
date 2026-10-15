import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase/client";

const AuthContext = createContext<{
  session: Session | null;
  loading: boolean;
  error: string | null;
}>({ session: null, loading: true, error: null });
export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    let active = true;
    let authRevision = 0;
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, next) => {
      if (active) {
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
          setSession(data.session);
          setError(error ? "We couldn't restore your session. Please sign in again." : null);
          setLoading(false);
        }
      })
      .catch(() => {
        if (active && authRevision === restoreRevision) {
          setError("Sign-in is temporarily unavailable.");
          setLoading(false);
        }
      });
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);
  return (
    <AuthContext.Provider value={{ session, loading, error }}>{children}</AuthContext.Provider>
  );
}
export const useAuth = () => useContext(AuthContext);
