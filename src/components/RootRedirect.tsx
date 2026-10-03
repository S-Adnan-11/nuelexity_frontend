import { useEffect, useState } from "react";
import { Navigate } from "react-router";
import { supabase } from "@/lib/supabase/client";

export function RootRedirect() {
  const [session, setSession] = useState<boolean | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(!!session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(!!session);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  if (session === null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-[#2e026d] to-[#15162c] text-white">
        <p className="text-lg animate-pulse">Loading...</p>
      </div>
    );
  }

  return session ? <Navigate to="/dashboard" replace /> : <Navigate to="/auth" replace />;
}
