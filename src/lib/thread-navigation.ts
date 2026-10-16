const signInThreadKey = "nuelexity:sign-in-thread";
export const validThreadId = (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
export const threadPath = (id: string) => `/dashboard/${encodeURIComponent(id)}`;

// Only an identifier crosses OAuth in tab storage; never accept a redirect URL.
export function rememberSignInThread(id: string | null) {
  try {
    if (id && validThreadId(id)) sessionStorage.setItem(signInThreadKey, id);
    else sessionStorage.removeItem(signInThreadKey);
  } catch { /* Sign-in still works when tab storage is unavailable. */ }
}
export function takeSignInThread(): string | null {
  try {
    const id = sessionStorage.getItem(signInThreadKey);
    sessionStorage.removeItem(signInThreadKey);
    return id && validThreadId(id) ? id : null;
  } catch { return null; }
}
