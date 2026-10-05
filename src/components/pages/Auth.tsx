import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import { ArrowLeft, Code2 } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { useAuth } from "../AuthProvider";

export default function Auth() {
  const { session, loading, error: sessionError } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const callback = window.location.pathname === "/auth/callback";
  useEffect(() => {
    if (session) navigate("/dashboard", { replace: true });
    const params = new URLSearchParams(window.location.search);
    const hash = new URLSearchParams(window.location.hash.slice(1));
    if (params.has("error") || hash.has("error")) {
      setError("Sign-in wasn't completed. Please try again.");
      window.history.replaceState(null, "", "/auth");
    }
  }, [session, navigate]);
  useEffect(() => {
    if (!callback || session || loading) return;
    const timer = setTimeout(() => setError("Sign-in couldn't finish. Please try again."), 10000);
    return () => clearTimeout(timer);
  }, [callback, session, loading]);
  async function login(provider: "google" | "github") {
    if (!supabase) return;
    setError(null);
    setPending(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo: new URL("/auth/callback", window.location.origin).href },
      });
      if (error) {
        setError("Sign-in couldn't start. Check your connection or try another provider.");
        setPending(false);
      }
    } catch {
      setError("Sign-in is temporarily unavailable.");
      setPending(false);
    }
  }
  return (
    <main className="auth-page">
      <Link to="/dashboard" className="back-link">
        <ArrowLeft size={16} /> Back to search
      </Link>
      <div className="auth-card">
        <div className="brand-mark" aria-hidden="true">
          ✳
        </div>
        <p className="eyebrow">NUELEXITY</p>
        <h1>A little curiosity goes a long way.</h1>
        <p>Sign in to save your research and pick up where you left off.</p>
        {(error || sessionError) && (
          <p role="alert" className="error-notice">
            {error || sessionError}
          </p>
        )}
        {!supabase && (
          <p className="error-notice">
            Sign-in setup is incomplete. Add the public Supabase URL and publishable key to the
            frontend environment.
          </p>
        )}
        {loading || (callback && !error && !sessionError) ? (
          <p role="status">Finishing sign-in…</p>
        ) : (
          <>
            <button
              className="oauth-button"
              disabled={pending || !supabase}
              onClick={() => void login("google")}
            >
              <span className="google-symbol" aria-hidden="true">
                G
              </span>{" "}
              Continue with Google
            </button>
            <button
              className="oauth-button"
              disabled={pending || !supabase}
              onClick={() => void login("github")}
            >
              <Code2 size={19} /> Continue with GitHub
            </button>
            <Link to="/dashboard" className="guest-link">
              Or try a search as a guest
            </Link>
          </>
        )}
        <small>
          Your searches are sent to our search provider and, when enabled, our AI provider. Guest
          chats are temporary.
        </small>
      </div>
    </main>
  );
}
