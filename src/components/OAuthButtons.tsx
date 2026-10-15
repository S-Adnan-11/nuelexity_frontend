import { useState } from "react";
import { Code2 } from "lucide-react";
import { supabase } from "@/lib/supabase/client";

export function OAuthButtons() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function login(provider: "google" | "github") {
    if (!supabase || pending) return;
    setPending(true);
    setError(null);
    try {
      const { error } = await supabase.auth.signInWithOAuth({ provider,
        options: { redirectTo: new URL("/auth/callback", window.location.origin).href } });
      if (error) throw error;
    } catch {
      setError("Sign-in couldn't start. Check your connection or try another provider.");
      setPending(false);
    }
  }
  return <>
    <button className="oauth-button oauth-google" disabled={pending || !supabase} onClick={() => void login("google")}>
      <span className="google-symbol" aria-hidden="true">G</span> Continue with Google
    </button>
    <button className="oauth-button" disabled={pending || !supabase} onClick={() => void login("github")}>
      <Code2 size={18} aria-hidden="true" /> Continue with GitHub
    </button>
    {pending && <p role="status" className="model-hint">Opening sign-in…</p>}
    {error && <p role="alert" className="error-notice">{error}</p>}
    {!supabase && <p className="model-hint">Sign-in setup is incomplete. Please try again later.</p>}
  </>;
}
