import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import { ArrowLeft } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { useAuth } from "../AuthProvider";
import { BrandLogo, BrandMark } from "../Brand";
import { OAuthButtons } from "../OAuthButtons";

export default function Auth() {
  const { session, loading, error: sessionError } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
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
  return (
    <main className="auth-page">
      <Link to="/dashboard" className="back-link">
        <ArrowLeft size={16} /> Back to search
      </Link>
      <div className="auth-card">
        <BrandMark size={120} />
        {/* <div className="auth-logo"><BrandLogo /></div> */}
        <h1>Curiosity killed the cat, <span style={{color:'#3e684f'}}>Nuelexity</span> brought it back!</h1>
        <p>Sign in to save your research and access more models.</p>
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
            <OAuthButtons />
            <Link to="/dashboard" className="guest-link">
              Or continue as a guest
            </Link>
          </>
        )}
        <small>
          A little curiousity goes a looong wayy..
        </small>
      </div>
    </main>
  );
}
