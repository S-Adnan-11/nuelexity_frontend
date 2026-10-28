export const canonicalOrigin = "https://nuelexity.devs.surf";
export function routeMetadata(path: string) {
  if (path === "/") return { title: "Nuelexity — Follow your curiosity", description: "Search the web, read streamed answers and inspect numbered sources. Nuelexity is an independent AI research project built for learning.", canonical: "/", index: true };
  if (path === "/about") return { title: "About Nuelexity — A project for curious minds", description: "See how Nuelexity searches the web, streams answers and connects follow-up questions with sources you can inspect.", canonical: "/about", index: true };
  if (path === "/legal") return { title: "Privacy, storage & terms — Nuelexity", description: "How Nuelexity handles sign-in, research conversations, guest verification and browser storage, with terms for using the project.", canonical: "/legal", index: true };
  if (path === "/account") return { title: "Your account — Nuelexity", description: "Your private Nuelexity account.", canonical: null, index: false };
  if (path === "/auth" || path === "/auth/callback") return { title: "Sign in — Nuelexity", description: "Sign in to your Nuelexity workspace.", canonical: null, index: false };
  if (/^\/dashboard(?:\/[^/]+)?$/.test(path)) return { title: "Research workspace — Nuelexity", description: "Your Nuelexity research workspace.", canonical: null, index: false };
  return { title: "Page not found — Nuelexity", description: "This Nuelexity page could not be found.", canonical: null, index: false };
}
