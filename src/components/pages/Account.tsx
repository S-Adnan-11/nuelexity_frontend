import { useRef } from "react";
import { Link, Navigate } from "react-router";
import { useAuth } from "../AuthProvider";
import { Avatar } from "../Avatar";
import { accountProfile } from "../../lib/profile";
import { PublicLayout } from "./PublicPages";

export default function Account() {
  const leaving = useRef(false);
  const { session, loading, error, signOut, signingOut } = useAuth();
  if (loading) return <PublicLayout><section className="document-title"><h1>Your account</h1><p role="status">Checking your session…</p></section></PublicLayout>;
  if (!session && signingOut) return <PublicLayout><p role="status">Closing your workspace…</p></PublicLayout>;
  if (!session) return <Navigate to={leaving.current ? "/dashboard" : "/auth?return=account"} replace />;
  const profile = accountProfile(session.user);
  return <PublicLayout><section className="account-page">
    <p className="eyebrow">YOUR CORNER OF CURIOSITY</p><h1>Your account.</h1>
    <div className="account-card">
      <div className="account-identity"><Avatar key={session.user.id} user={session.user} size={88} /><div><h2>{profile.name || "Your Nuelexity account"}</h2><p>Profile details supplied through sign-in.</p></div></div>
      <dl className="account-details"><div><dt>Display name</dt><dd>{profile.name || "Not provided by your identity provider"}</dd></div>
        <div><dt>Email</dt><dd>{profile.email || "Not shared by your identity provider"}</dd></div>
        <div><dt>Linked sign-in providers</dt><dd>{profile.providers.length ? profile.providers.map(provider => provider === "github" ? "GitHub" : "Google").join(" · ") : "Provider details unavailable"}</dd></div></dl>
      <p className="account-note">Your profile is managed by your sign-in provider. Nuelexity displays the information your provider shares at sign-in.</p>
      <div className="account-actions"><button className="primary-link" disabled={signingOut} onClick={() => { leaving.current = true; void signOut(); }}>{signingOut ? "Signing out…" : "Sign out"}</button><Link className="quiet-button" to="/dashboard">Back to research</Link></div>
      {signingOut && <p role="status">Closing your workspace…</p>}{error && <p className="error-notice" role="alert">{error}</p>}
    </div><p className="account-note">Saved threads can be deleted from your research library. <Link to="/legal#privacy">Read about your data</Link>.</p>
  </section></PublicLayout>;
}
