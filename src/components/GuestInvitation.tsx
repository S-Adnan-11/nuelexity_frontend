import { useState } from "react";
import { X } from "lucide-react";
import { BrandMark } from "./Brand";
import { OAuthButtons } from "./OAuthButtons";

const dismissalKey = "nuelexity:guest-invitation-dismissed";
export function GuestInvitation() {
  const [dismissed, setDismissed] = useState(() => {
    try { return sessionStorage.getItem(dismissalKey) === "1"; } catch { return false; }
  });
  if (dismissed) return null;
  return <aside className="guest-invitation" aria-labelledby="guest-invitation-title">
    <button className="icon-button dismiss-invitation" aria-label="Dismiss sign-in invitation" onClick={() => {
      setDismissed(true);
      try { sessionStorage.setItem(dismissalKey, "1"); } catch { /* Dismissal still works until navigation. */ }
    }}><X size={17} /></button>
    <BrandMark size={48} />
    <h2 id="guest-invitation-title">Make room for <em>your curiosity.</em></h2>
    <p>Sign in to save your research and access more models.</p>
    <OAuthButtons />
    <small>Guest chats stay temporary.</small>
  </aside>;
}
