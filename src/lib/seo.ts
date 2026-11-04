export const canonicalOrigin = "https://nuelexity.devs.surf";
export const publicPaths = ["/", "/about", "/legal"] as const;
export function routeStructuredData(path: string) {
  if (path !== "/" && path !== "/about") return null;
  return { "@context": "https://schema.org", "@type": path === "/" ? "WebSite" : "AboutPage",
    name: path === "/" ? "Nuelexity" : "About Nuelexity", url: canonicalOrigin + path,
    description: routeMetadata(path).description, inLanguage: "en" };
}
export function serializedStructuredData(path: string) {
  const data = routeStructuredData(path);
  return data ? JSON.stringify(data).replaceAll("<", "\\u003c") : null;
}
export function routeMetadata(path: string) {
  if (path === "/") return { title: "Nuelexity — Follow your curiosity", description: "Search the web, read streamed answers and inspect numbered sources. Nuelexity is an independent AI research project built for learning.", canonical: "/", index: true };
  if (path === "/about") return { title: "About Nuelexity — A project for curious minds", description: "See how Nuelexity searches the web, streams answers and connects follow-up questions with sources you can inspect.", canonical: "/about", index: true };
  if (path === "/legal") return { title: "Privacy, storage & terms — Nuelexity", description: "How Nuelexity handles sign-in, research conversations, guest verification and browser storage, with terms for using the project.", canonical: "/legal", index: true };
  if (path === "/account") return { title: "Your account — Nuelexity", description: "Your private Nuelexity account.", canonical: null, index: false };
  if (path === "/auth" || path === "/auth/callback") return { title: "Sign in — Nuelexity", description: "Sign in to your Nuelexity workspace.", canonical: null, index: false };
  if (/^\/dashboard(?:\/[^/]+)?$/.test(path)) return { title: "Research workspace — Nuelexity", description: "Your Nuelexity research workspace.", canonical: null, index: false };
  return { title: "Page not found — Nuelexity", description: "This Nuelexity page could not be found.", canonical: null, index: false };
}
