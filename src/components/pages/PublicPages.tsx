import type { ReactNode } from "react";
import { Link } from "react-router";
import { BrandLogo, BrandMark } from "../Brand";
import { Footer } from "../Footer";
import { ProductDemo } from "../ProductDemo";
import { ReturnCat } from "../ReturnCat";
import content from "../../../site-content.json";

function publicLink(value: unknown, github = false) {
  try {
    const url = new URL(typeof value === "string" ? value : "");
    return url.protocol === "https:" && !url.username && !url.password && (!github || url.hostname === "github.com") ? url.href : null;
  } catch { return null; }
}
export function PublicLayout({ children }: { children: ReactNode }) {
  return <div className="document-page">
    <a className="skip-link" href="#page-content">Skip to content</a>
    <header className="document-header"><Link to="/" aria-label="Nuelexity home"><BrandLogo /></Link>
      <nav aria-label="Main navigation"><Link to="/about">About</Link><Link className="quiet-button" to="/dashboard">Open workspace <span aria-hidden="true">↗</span></Link></nav>
    </header>
    <main id="page-content" tabIndex={-1}>{children}</main><Footer />
  </div>;
}
export function About() {
  const github = publicLink(content.developer.github, true), portfolio = publicLink(content.developer.portfolio);
  return <PublicLayout>
    <section className="about-hero">
      <div><p className="eyebrow">A PROJECT FOR CURIOUS MINDS</p><h1>A question is<br />a good beginning.</h1>
        <p className="document-lead">The web has plenty to say. Nuelexity explores how search can become a readable answer with sources you can inspect.</p>
        <p>Built for learning, one question at a time.</p><Link className="primary-link" to="/dashboard">Follow your curiosity <span aria-hidden="true">↗</span></Link>
      </div>
      <ReturnCat />
    </section>
    <section className="document-section demo-section" aria-labelledby="demo-title"><p className="eyebrow">FROM QUESTION TO EVIDENCE</p><h2 id="demo-title">Start with a question. Follow what makes you curious.</h2>
      <p className="demo-intro">Explore an answer, check its sources and let what you learn shape the next question.</p>
      <ProductDemo />
    </section>
    <section className="document-section two-column"><div><p className="eyebrow">THE LEARNING BEHIND IT</p><h2>Making the pieces<br />work together.</h2></div><div>
      <p>Building Nuelexity meant learning how to give a model useful context: the question, relevant passages from the web and enough of the conversation to keep a follow-up on topic. That is the context engineering behind the answer.</p>
      <p>Retrieval brings in sources you can check. Streaming lets you begin reading as the answer arrives. Application development connects those pieces with sign-in, saved threads and shared search limits.</p>
      <p>The Return Cat is its reminder to keep asking. We also like cats. Nuelexity is an independent project and is not affiliated with Perplexity.</p>
    </div></section>
    <section className="document-section"><p className="eyebrow">WHAT IT IS BUILT WITH</p><h2>A practical, inspectable stack.</h2>
      <ul className="stack-list"><li><strong>React + TypeScript</strong><span>React Router, Vite, Tailwind CSS, Radix controls and safe Markdown rendering.</span></li>
      <li><strong>Node.js + Express</strong><span>The server handles search requests and streams answers to the interface.</span></li>
      <li><strong>Supabase</strong><span>Google/GitHub sign-in and PostgreSQL storage for saved conversations.</span></li>
      <li><strong>Tavily · Groq · Turnstile</strong><span>Tavily retrieves web sources. Groq serves the answer models. Cloudflare Turnstile helps protect guest search from bots.</span></li></ul>
    </section>
    <section className="document-section two-column"><div><h2>Useful today.<br />Room to grow.</h2></div><div>
      <h3>Available now</h3><p>Guest research, streamed answers, numbered sources, suggested follow-up questions, Google/GitHub sign-in, private saved threads, conversation navigation and a choice of supported models for signed-in users.</p>
      <h3>Real limits</h3><p>Search grounding makes evidence easier to inspect. It cannot guarantee accuracy, complete coverage, reliable sources or a citation for every sentence. Answers may be wrong or incomplete; important decisions need independent verification.</p>
      <p>Free provider allowances and shared quotas limit availability. Conversation context and answer length are limited. Guest threads are temporary. There is no public sharing, file upload, subscription or autonomous browsing agent.</p>
    </div></section>
    <section className="developer-card"><BrandMark size={44} /><div><p className="eyebrow">BEHIND THE PROJECT</p><h2>{content.developer.displayName || "An independent learning project"}</h2>
      <p>Built with curiosity, an appetite for learning and a desire to understand how things work.</p>
      {(github || portfolio) && <nav aria-label="Developer links">{github && <a href={github} target="_blank" rel="noopener noreferrer">GitHub ↗</a>}{portfolio && <a href={portfolio} target="_blank" rel="noopener noreferrer">Portfolio ↗</a>}</nav>}
    </div></section>
  </PublicLayout>;
}
export function PublicHome() {
  return <PublicLayout><section className="about-hero"><div><p className="eyebrow">FOR THE CURIOUS MINDS</p><h1>Where curiosity<br />finds its answers.</h1><p className="document-lead">Search the web, read a streamed answer and inspect numbered sources with Nuelexity, an independent research project built for learning.</p><Link className="primary-link" to="/dashboard">Start a search ↗</Link><p>Guest research is available within shared limits. Sign in with Google or GitHub to save private conversations.</p><p>AI answers can be inaccurate. Follow the sources and verify what matters.</p></div><ReturnCat /></section></PublicLayout>;
}
export function Legal() {
  return <PublicLayout><header className="document-title"><p className="eyebrow">CLEAR WORDS, SMALL PRINT</p><h1>Privacy, storage &amp; terms.</h1>
    <p className="document-lead">How this research project handles information, and what to expect when using it.</p>
    <p className="policy-dates">Updated <time dateTime={content.reviewedDate}>{content.reviewedDate}</time>{content.effectiveDate ? <> · Effective <time dateTime={content.effectiveDate}>{content.effectiveDate}</time></> : " · Local pre-release review; not yet effective"}</p>
    {!content.publicationApproved && <p className="review-notice">Policy draft for review. These terms are not yet in effect.</p>}
    {content.operator && <p>Operated by {content.operator}.</p>}{content.privacyContact && <p>Privacy and access requests: <a href={`mailto:${content.privacyContact}`}>{content.privacyContact}</a>.</p>}
  </header><nav className="legal-nav" aria-label="Legal sections"><Link to="#privacy">Privacy</Link><Link to="#cookies">Cookies &amp; storage</Link><Link to="#terms">Terms</Link></nav>
    <section id="privacy" className="document-section legal-section"><h2>Privacy</h2>
      <h3>Information used to provide research</h3><p>Signing in through Google or GitHub supplies Supabase Auth with identity information such as an account identifier, name, available email and profile picture. Nuelexity displays the fields already supplied. A private or missing email may be unavailable. No additional permissions are requested for the account page.</p>
      <p>Signed-in questions, answers (including incomplete attempts), source links and excerpts, suggested follow-ups, model metadata and timestamps are saved in Supabase PostgreSQL under your account ID. Conversation titles come from the first question. Guest threads stay in the current workspace’s memory and are not automatically imported after sign-in.</p>
      <h3>Where questions go</h3><p>The backend sends Tavily the current question, with up to 400 characters of the preceding user question for follow-ups, within a 1,000-character retrieval query. When AI is enabled, Groq receives the question, clipped search titles and excerpts, and up to six clipped complete conversation turns, further trimmed to fit a bounded input. Google and GitHub provide sign-in; they do not receive your research conversation through this integration.</p>
      <p>Cloudflare Turnstile checks guest requests. Its browser widget receives browser/network signals, which Cloudflare also processes to improve bot detection under its privacy addendum; the backend sends the verification token and raw IP address to Cloudflare’s verification service. The host and network providers also receive connection information. Opening a source or loading a provider avatar contacts that site.</p>
      <h3>Security and limits</h3><p>The application uses account IDs and secret-keyed IP hashes for quotas, plus temporary request leases. These are pseudonymous records, not anonymous data. Raw IP addresses are used transiently by the API and its in-memory throttle; they are not written to the application quota tables. Hosting and provider logs may handle IP addresses separately.</p>
      <h3>Backend hosting</h3><p>The backend is hosted on Render’s Free Web Service. Render and its network providers receive connection information. The application has no request logger or analytics exporter and does not log research text, authentication tokens or guest passes. Render documents seven-day application-log visibility for Hobby workspaces and HTTP request logs for Pro workspaces and above. Infrastructure security processing is separate; actual region and account settings still need deployment verification.</p>
      <h3>Retention and control</h3><p>Saved conversations have no automatic expiry in the current application. You can delete individual threads and their messages from the library. There is no self-service account deletion or full export feature. Clearing browser storage or signing out does not delete server history.</p>
      <p>Quota cleanup runs on successful reservations: day/month records older than 62 days and minute records older than a day become eligible for removal. Expired leases are released or cleaned later. This is not a guaranteed deletion schedule during inactivity. Provider logs and backups follow separate arrangements; deleting a thread cannot promise their immediate erasure.</p>
      <h3>Providers and international processing</h3><p>Supabase, Tavily, Groq and Cloudflare process information to operate the features above. Processing may cross borders, including outside Nigeria. Groq documents default non-retention of inference content with limited reliability/abuse exceptions and separately retained usage metadata. We have not verified this project’s dashboard retention settings. Tavily’s policy permits some query data to improve responses and limited sharing with search indexes; this project’s contract settings and a fixed API-query deletion deadline have not been verified.</p>
      <p>See <a href="https://supabase.com/privacy" target="_blank" rel="noopener noreferrer">Supabase privacy</a>, <a href="https://www.tavily.com/privacy" target="_blank" rel="noopener noreferrer">Tavily privacy</a>, <a href="https://console.groq.com/docs/your-data" target="_blank" rel="noopener noreferrer">Groq data handling</a> and <a href="https://www.cloudflare.com/privacypolicy/" target="_blank" rel="noopener noreferrer">Cloudflare privacy</a> for their own practices.</p>
      <h3>Purposes, requests and updates</h3><p>Information is used for requested search and account features, saving research, preventing abuse and maintaining service reliability. The intended legal basis for core requested features is providing the service; security processing requires an assessed legitimate interest or other applicable basis. The operator’s final legal assessment and cross-border arrangements must be approved before public beta.</p>
      <p>Access, correction and deletion requests need identity verification and operator handling. Contact {content.privacyContact || "the project operator"}; never send passwords or session tokens. The manual request workflow still needs final approval. Provider-held records may require separate requests. Policy changes will update this page and its dates; material changes should be brought to users’ attention.</p>
    </section>
    <section id="cookies" className="document-section legal-section"><h2>Cookies &amp; storage</h2>
      <p>Nuelexity currently has no advertising, optional analytics or error-tracking service. Nuelexity does not set application cookies for authentication. Its Supabase browser client stores the session in localStorage to keep you signed in and refresh it. OAuth providers and bot protection may use their own cookies or storage in their respective contexts.</p>
      <ul className="storage-list"><li><strong>Sign-in:</strong> Supabase’s project-scoped auth session and temporary PKCE verifier in localStorage. Removed on successful sign-out or exchange as appropriate; the session otherwise persists until cleared or invalidated.</li><li><strong>Guest verification:</strong> a signed, IP-bound pass in sessionStorage, valid for up to two hours. Clearing it does not reset server quotas.</li><li><strong>Navigation:</strong> account-scoped active-thread IDs and scroll positions in sessionStorage. These contain identifiers and positions, not saved messages, and are cleared on account replacement/sign-out in open tabs.</li><li><strong>Interface state:</strong> a per-tab dismissed sign-in invitation and a validated one-use sign-in return destination. No marketing profile is created.</li></ul>
      <p>Browser storage supports sign-in, security and the interface features described above. These uses still need review under the rules applicable to the intended audience. If optional tracking is introduced, the policy and any required prior consent must be reviewed first.</p>
      <p>You can clear site storage through your browser. This signs you out or resets local interface/verification state; it does not erase saved server conversations. External identity and source sites have their own controls.</p>
    </section>
    <section id="terms" className="document-section legal-section"><h2>Terms</h2>
      <h3>A research project in beta</h3><p>Nuelexity is an independent learning project with limited free provider capacity. Features may change, fail or be unavailable. Quotas and technical limits apply to guests and accounts. An interrupted or failed attempt may still consume allowance; requests are not automatically retried.</p>
      <p>The intended beta is public and accessible to anyone within shared limits. Render Free can sleep after inactivity, take time to start, restart or suspend service when allowances are exhausted. Starting the service may add a wait before research can begin.</p>
      <h3>Use your judgement</h3><p>AI output and retrieved sources can be wrong, outdated, biased or incomplete. Citations help you inspect evidence and do not certify an answer. Verify important claims with original sources and qualified advice where appropriate.</p>
      <h3>Use the service responsibly</h3><p>Do not attempt to access someone else’s conversations, bypass quotas or bot checks, attack the service, submit unlawful content, or infringe others’ rights. Do not submit credentials, confidential material or personal information you lack permission to share. Access may be restricted to protect users and the service.</p>
      <h3>Your content and other people’s work</h3><p>You remain responsible for what you submit and for having the rights needed to do so. Providing a question permits the processing needed to return and, for signed-in threads, store the research described above. Third-party pages, excerpts and trademarks belong to their respective rights holders; a citation does not grant a licence to republish them. Output may resemble other output and is not guaranteed to be exclusive.</p>
      <h3>Changes and applicable rights</h3><p>Changes to these terms will be recorded with updated dates. Nothing here removes rights that applicable law does not allow to be waived. Final operator responsibility, eligibility and governing-law decisions remain part of the pre-release review.</p>
    </section>
  </PublicLayout>;
}
export function NotFound() {
  return <PublicLayout><section className="document-title"><p className="eyebrow">A SMALL DETOUR</p><BrandMark size={88} /><h1>This trail ends here.</h1><p>The page could not be found. Your next question is still welcome.</p><Link className="primary-link" to="/dashboard">Back to search ↗</Link></section></PublicLayout>;
}
