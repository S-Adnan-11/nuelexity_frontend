import type { User } from "@supabase/supabase-js";

const text = (value: unknown) => typeof value === "string" && value.trim() ? value.trim().slice(0, 512) : null;
const picture = (value: unknown) => {
  try {
    const url = new URL(text(value) || "");
    return url.protocol === "https:" && !url.username && !url.password ? url.href : null;
  } catch { return null; }
};

// Metadata is display data, never authorization. Keep each identity's fields together.
export function accountProfile(user: User) {
  const identities = [...(user.identities || [])].filter(identity => ["google", "github"].includes(identity.provider));
  const primary = identities.find(identity => identity.provider === user.app_metadata?.provider) || identities[0];
  const data = primary?.identity_data || user.user_metadata || {};
  const name = text(data.full_name) || text(data.name) || text(data.user_name) || text(data.preferred_username);
  const email = text(user.email) || text(data.email);
  const avatar = picture(data.avatar_url) || picture(data.picture);
  const initials = name ? name.split(/\s+/u).filter(Boolean).slice(0, 2).map(part => Array.from(part)[0]).join("").toLocaleUpperCase() : null;
  return { name, email, avatar, initials, providers: [...new Set(identities.map(identity => identity.provider))] };
}

export function clearPrivateNavigation(userId: string | null) {
  try {
    for (const key of Object.keys(sessionStorage)) {
      if (key === "nuelexity:sign-in-thread" || key === "nuelexity:sign-in-account" ||
          (userId && (key === `nuelexity:active-thread:${userId}` || key.startsWith(`nuelexity:scroll:${userId}:`))))
        sessionStorage.removeItem(key);
    }
  } catch { /* Blocked storage must not prevent signing out. */ }
}
