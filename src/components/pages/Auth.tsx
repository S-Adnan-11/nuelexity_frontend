import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { ArrowLeft } from "lucide-react";
import { useAuth } from "../AuthProvider";
import { BrandMark } from "../Brand";
import { Footer } from "../Footer";
import { OAuthButtons } from "../OAuthButtons";
import { rememberSignInThread, takeSignInThread, threadPath, validThreadId } from "@/lib/thread-navigation";

export default function Auth() {
  const { session, loading, error: sessionError } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [error, setError] = useState<string | null>(null);
  const callback = location.pathname === "/auth/callback";
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const hash = new URLSearchParams(location.hash.slice(1));
    const requested = params.get("thread");
    if (session) {
      const stored = takeSignInThread();
      const id = requested && validThreadId(requested) ? requested : callback ? stored : null;
      let account = params.get("return") === "account";
      try { account ||= callback && sessionStorage.getItem("nuelexity:sign-in-account") === "1"; sessionStorage.removeItem("nuelexity:sign-in-account"); } catch {}
      navigate(id ? threadPath(id) : account ? "/account" : "/dashboard", { replace: true });
      return;
    }
    if (!callback) {
      rememberSignInThread(requested);
      try { if (params.get("return") === "account") sessionStorage.setItem("nuelexity:sign-in-account", "1"); else sessionStorage.removeItem("nuelexity:sign-in-account"); } catch {}
    }
    if (params.has("error") || hash.has("error")) {
      rememberSignInThread(null);
      setError("Sign-in wasn't completed. Please try again.");
      window.history.replaceState(null, "", "/auth");
    }
  }, [session, navigate, callback, location.search, location.hash]);
  useEffect(() => {
    if (!callback || session || loading) return;
    const timer = setTimeout(() => setError("Sign-in couldn't finish. Please try again."), 10000);
    return () => clearTimeout(timer);
  }, [callback, session, loading]);
  return (
    <main id="page-content" tabIndex={-1} className="auth-page">
      <Link to="/dashboard" className="back-link">
        <ArrowLeft size={16} /> Back to search
      </Link>
      <div className="auth-card">
        <BrandMark size={120} />
        <h1>Curiosity killed the cat, <span style={{color:'var(--nx-link)'}}>Nuelexity</span> brought it back!</h1>
        <p>Sign in to save your research and access more models.</p>
        {(error || sessionError) && (
          <p role="alert" className="error-notice">
            {error || sessionError}
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
          A little curiosity goes a long way.
        </small>
      </div>
      <Footer />
    </main>
  );
}
