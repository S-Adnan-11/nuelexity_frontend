import { useEffect } from "react";
import { useLocation } from "react-router";
import { canonicalOrigin, routeMetadata, serializedStructuredData } from "../lib/seo";
export function RouteEffects() {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    const meta = routeMetadata(pathname);
    const data = serializedStructuredData(pathname);
    const schemas = [...document.head.querySelectorAll('script[type="application/ld+json"]')];
    if (!data || schemas.length !== 1 || schemas[0]?.textContent !== data) {
      schemas.forEach(node => node.remove());
      if (data) {
        const schema = document.createElement("script");
        schema.type = "application/ld+json"; schema.textContent = data;
        document.head.append(schema);
      }
    }
    document.title = meta.title;
    function set(selector: string, attribute: string, value: string) {
      document.head.querySelector(selector)?.setAttribute(attribute, value);
    }
    set('meta[name="description"]', "content", meta.description);
    set('meta[name="robots"]', "content", meta.index && !location.hostname.endsWith(".pages.dev") ? "index,follow" : "noindex,nofollow");
    set('meta[property="og:title"]', "content", meta.title);
    set('meta[property="og:description"]', "content", meta.description);
    set('meta[name="twitter:title"]', "content", meta.title);
    set('meta[name="twitter:description"]', "content", meta.description);
    let canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (meta.canonical) {
      if (!canonical) { canonical = document.createElement("link"); canonical.rel = "canonical"; document.head.append(canonical); }
      canonical.href = canonicalOrigin + meta.canonical;
      let ogUrl = document.head.querySelector<HTMLMetaElement>('meta[property="og:url"]');
      if (!ogUrl) { ogUrl = document.createElement('meta'); ogUrl.setAttribute('property', 'og:url'); document.head.append(ogUrl); }
      ogUrl.content = canonical.href;
    } else { canonical?.remove(); document.head.querySelector('meta[property="og:url"]')?.remove(); }
    if (!pathname.startsWith("/dashboard") && pathname !== "/") {
      let id = "page-content";
      try { if (hash) id = decodeURIComponent(hash.slice(1)); } catch { /* Malformed anchors do not break navigation. */ }
      // Initial fragment navigation can otherwise focus a prerendered node that
      // React replaces. Finish loading before focusing the current DOM target.
      let frame = 0;
      const focus = () => {
        frame = requestAnimationFrame(() => {
          const target = document.getElementById(id);
          if (target) {
            target.tabIndex = -1;
            target.focus({ preventScroll: true });
            if (hash) target.scrollIntoView();
            else window.scrollTo(0, 0);
          }
        });
      };
      if (document.readyState === "complete") focus();
      else window.addEventListener("load", focus, { once: true });
      return () => { window.removeEventListener("load", focus); cancelAnimationFrame(frame); };
    }
  }, [pathname, hash]);
  return null;
}
