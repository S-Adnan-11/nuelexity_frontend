import { BrandLogo } from "./Brand";

// Static startup HTML cannot know this tab's eligibility or session. Keep it
// neutral until the existing entry flow can restore them in the browser.
export function ResearchEntry() {
  return <main id="page-content" className="workspace-pending" tabIndex={-1}>
    <BrandLogo /><h1 className="sr-only">Nuelexity research</h1>
    <p role="status">Opening your workspace…</p>
    <noscript><p>Research, guest verification and sign-in require JavaScript. You can read <a href="/about">About Nuelexity and the demonstration</a> or the <a href="/legal">privacy, storage and terms</a> without it.</p></noscript>
  </main>;
}
