import { createContext, useContext, useState, type ReactNode } from "react";
import { Globe } from "lucide-react";
import { Link } from "react-router";
import { BrandLogo, BrandMark } from "../Brand";
import { ThemeToggle } from "../ThemeToggle";
import { Footer } from "../Footer";
import { ProductDemo } from "../ProductDemo";
import { ReturnCat } from "../ReturnCat";
import { GitHubIcon } from "../GitHubIcon";
import content from "../../../site-content.json";

export const PublicInformation = createContext(false);
export function LaunchStatus() {
  return <p className="launch-status" role="status">Public preview. Research and sign-in are not open yet.</p>;
}
function publicLink(value: unknown, github = false) {
  try {
    const url = new URL(typeof value === "string" ? value : "");
    return url.protocol === "https:" && !url.username && !url.password && (!github || url.hostname === "github.com") ? url.href : null;
  } catch { return null; }
}
export function PublicLayout({ children, wide = false }: { children: ReactNode; wide?: boolean }) {
  const limited = useContext(PublicInformation);
  return <div className={`document-page${wide ? " about-page" : ""}`}>
    <a className="skip-link" href="#page-content">Skip to content</a>
    <header className="document-header"><Link to="/" aria-label="Nuelexity home"><BrandLogo /></Link>
      <nav aria-label="Main navigation"><Link to="/about">About</Link>{limited ? <Link className="quiet-button" to="/#launch-status">Launch status</Link> : <Link className="quiet-button" to="/dashboard">Open workspace <span aria-hidden="true">↗</span></Link>}</nav><ThemeToggle />
    </header>
    <main id="page-content" tabIndex={-1}>{children}</main><Footer />
  </div>;
}
function DeveloperLink({ href, children }: { href: string; children: ReactNode }) {
  const [dismissed, setDismissed] = useState(false);
  return <a className="developer-link" href={href} target="_blank" rel="noopener noreferrer"
    data-label-dismissed={dismissed || undefined} onFocus={() => setDismissed(false)} onMouseEnter={() => setDismissed(false)}
    onKeyDown={event => { if (event.key === "Escape") setDismissed(true); }}>
    {children}
  </a>;
}
export function About() {
  const limited = useContext(PublicInformation);
  const github = publicLink(content.developer.github, true), portfolio = publicLink(content.developer.portfolio);
  return <PublicLayout wide>
    <section className="about-hero">
      <div><p className="eyebrow">A PROJECT FOR CURIOUS MINDS</p><h1>A question is<br />a good beginning.</h1>
        <p className="document-lead">The web has plenty to say. Nuelexity explores how search can become a readable answer with sources you can inspect.</p>
        <p>Built for learning, one question at a time.</p>{limited ? <LaunchStatus /> : <Link className="primary-link" to="/dashboard">Follow your curiosity <span aria-hidden="true">↗</span></Link>}
      </div>
      <ReturnCat />
    </section>
    <section className="document-section demo-section" aria-labelledby="demo-title"><p className="eyebrow">FROM QUESTION TO EVIDENCE</p><h2 id="demo-title">Start with a question. Follow what makes you curious.</h2>
      <p className="demo-intro">Explore an answer, check its sources and let what you learn shape the next question.</p>
      <div className="demo-story"><ProductDemo /><div className="demo-notes">
        <h3>Ask a question</h3><p>Start with what you want to understand. The example begins with quantum computing.</p>
        <h3>Inspect the sources</h3><p>Use the numbered references to open the original material and check the explanation.</p>
        <h3>Continue with a follow-up</h3><p>Ask about one part of the answer. The conversation supplies context for the next question.</p>
      </div></div>
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
      <h3>{limited ? "Inside the application" : "Available now"}</h3><p>Guest research, streamed answers, numbered sources, suggested follow-up questions, Google/GitHub sign-in, private saved threads, conversation navigation and a choice of supported models for signed-in users.</p>
      <h3>Real limits</h3><p>Search grounding makes evidence easier to inspect. It cannot guarantee accuracy, complete coverage, reliable sources or a citation for every sentence. Answers may be wrong or incomplete; important decisions need independent verification.</p>
      <p>Free provider allowances and shared quotas limit availability. Conversation context and answer length are limited. Guest threads are temporary. There is no public sharing, file upload, subscription or autonomous browsing agent.</p>
    </div></section>
    <section className="developer-card"><BrandMark size={45} /><div><p className="eyebrow">BEHIND THE PROJECT</p><h2>{content.developer.displayName || "An independent learning project"}</h2>
      <p>Built with curiosity, an appetite for learning and a desire to understand how things work.</p>
      {(github || portfolio) && <nav aria-label="Developer links">{github && <DeveloperLink href={github} ><GitHubIcon /></DeveloperLink>}{portfolio && <DeveloperLink href={portfolio}><Globe size={20} aria-hidden="true" focusable="false" /></DeveloperLink>}</nav>}
    </div></section>
  </PublicLayout>;
}
export function PublicHome() {
  const limited = useContext(PublicInformation);
  return <PublicLayout><section className="about-hero"><div><p className="eyebrow">FOR THE CURIOUS MINDS</p><h1>Where curiosity<br />finds its answers.</h1><p className="document-lead">Search the web, read a streamed answer and inspect numbered sources with Nuelexity, an independent research project built for learning.</p>
    {limited ? <><div id="launch-status"><LaunchStatus /></div><Link className="primary-link" to="/about">See how it works ↗</Link><p>Explore the prepared demonstration and read our policies while we prepare research and sign-in for launch. Research and account use will be for adults aged 18 or above, or the higher applicable age of majority.</p></> : <><Link className="primary-link" to="/dashboard">Start a search ↗</Link><p>Adults can research within shared limits. Sign in with Google or GitHub to save private conversations.</p></>}
    <p>AI answers can be inaccurate. Follow the sources and verify what matters.</p></div><ReturnCat /></section></PublicLayout>;
}
export function Unavailable() {
  return <PublicLayout><section className="document-title"><h1>Research is coming.</h1><LaunchStatus /><p>You can explore <Link to="/about">About Nuelexity</Link> and read our <Link to="/legal">privacy, storage and terms</Link> without an account.</p></section></PublicLayout>;
}
export function Legal() {
  const limited = useContext(PublicInformation);
  return <PublicLayout><header className="document-title"><p className="eyebrow">CLEAR WORDS, SMALL PRINT</p><h1>Privacy, storage &amp; terms.</h1>
    <p className="document-lead">How Nuelexity handles your information and what to expect when using it.</p>
    {content.effectiveDate && <p className="policy-dates">Effective <time dateTime={content.effectiveDate}>{content.effectiveDate}</time></p>}
    <p>Operated from Nigeria by {content.operator}.</p><p>Privacy and support: <a href={`mailto:${content.privacyContact}`}>{content.privacyContact}</a>.</p>
  </header><nav className="legal-nav" aria-label="Legal sections"><Link to="#privacy">Privacy</Link><Link to="#cookies">Cookies &amp; storage</Link><Link to="#terms">Terms</Link></nav>
    <section id="privacy" className="document-section legal-section"><h2>Privacy</h2>
      <h3>{limited ? "This public preview" : "Using Nuelexity"}</h3>
      {limited ? <p>This preview contains public information and a prepared demonstration. Research and sign-in are closed. These pages do not restore accounts, display private conversations or send questions to search or AI providers. You can read them without confirming your age. The research and account practices below describe how those features will work when they open.</p> : <p>Nuelexity helps adults research questions using web sources and AI answers. You can use temporary guest research or sign in to keep a private library. Public informational pages remain readable without an account or eligibility confirmation.</p>}
      <h3>Adults and appropriate information</h3><p>Research and account use are for adults aged 18 or above, or the higher applicable age of majority. You must affirm your eligibility and separately accept the terms before entering those features. This is self-declaration, not verified age. We do not routinely collect birth dates or identification documents. V1 has no child accounts, parental-consent registration or school deployments.</p>
      <p>If we learn that a user is underage, we stop their research/account access, review the information involved and arrange deletion or restriction, including requests to providers, subject to specific legal duties. You can report underage use without sending a child’s identity documents.</p>
      <h3>Accounts, research and support</h3><p>Google or GitHub sign-in supplies Supabase Auth with an account identifier, name, available email, profile picture and provider metadata. Some email addresses may be unavailable. We request no extra permissions just to display your account. Loading your optional profile picture contacts its host. Google and GitHub do not receive your research conversations through our sign-in integration.</p>
      <p>Signed-in questions, answers including incomplete attempts, source links and excerpts, suggested follow-ups, model information and timestamps are stored in Supabase under your account. Thread titles come from the first question. Guest threads stay in workspace memory and disappear when it reloads or closes. They are not automatically imported into an account. Guest questions still pass through the API and research providers.</p>
      <p>If you email us, we receive your address, message and information needed to handle your request in our Google Gmail mailbox. Send only what is necessary. We restrict request records and remove working copies when their purpose ends, subject to specific legal duties.</p>
      <h3>Who receives information</h3><p>Tavily receives your question and a short amount of preceding question context for follow-ups to retrieve web sources. Groq receives your question, clipped search passages and a limited recent conversation context to produce an answer. Context and answer length are limited; the full saved library is not sent with each request.</p>
      <p>After eligibility confirmation, entering the guest workspace automatically loads Cloudflare Turnstile when a security check is needed. Cloudflare receives browser/network signals, and our API sends it the verification token and your IP address. Cloudflare also uses Turnstile data for its bot-detection purposes. Turnstile does not load on public informational pages. Opening source, developer or provider links contacts the destination site. Fonts, brand assets and the prepared demonstration are served locally.</p>
      <p>{limited ? "Cloudflare Pages serves the public website; Render hosts the research API when you use application features." : "Cloudflare Pages serves the website and Render hosts the research API."} Hosting and network providers receive IP addresses and connection/request details to deliver and protect the service. The application has no optional analytics, advertising or error-reporting exporter and does not log research text, authentication tokens or guest passes. Provider security logs are separate.</p>
      <h3>Purposes and lawful grounds</h3><p>We use information needed to provide the research, account and saved-library service you request under the terms, relying on contract where appropriate. Our legitimate interests in proportionate abuse prevention, service security and protecting shared capacity support necessary security processing. Quotas use account identifiers and secret-keyed IP hashes; these are pseudonymous personal data. Raw IPs are used transiently by the API rather than stored in its quota tables. We also process what is necessary to handle privacy requests and meet applicable legal duties.</p>
      <p>Accepting terms is not blanket consent. Where the law requires consent for a particular use or transfer, it must be informed and separate, with a way to decline and withdraw. We do not offer optional tracking, advertising or child accounts, or invite you to submit sensitive personal information.</p>
      <h3>Providers and international processing</h3><p>Our providers process information internationally. Supabase’s core hosting follows the project’s selected region, with additional support and operational processing elsewhere. Groq collects usage metadata and normally does not retain inference content, but may temporarily keep content for reliability or abuse handling; retained content is stored in the United States. Tavily’s policy permits query use for response improvement and limited sharing with search indexes unless different contract terms apply. Cloudflare operates a global network. A local connection does not mean all processing stays in Nigeria.</p>
      <p>Transfer arrangements must meet applicable Nigerian law, including required safeguards or separate consent. We do not promise exclusive Nigerian storage, zero provider retention or immediate erasure from every provider system. For their own practices, see <a href="https://supabase.com/privacy" target="_blank" rel="noopener noreferrer">Supabase</a>, <a href="https://www.tavily.com/privacy" target="_blank" rel="noopener noreferrer">Tavily</a>, <a href="https://console.groq.com/docs/your-data" target="_blank" rel="noopener noreferrer">Groq</a>, <a href="https://render.com/privacy" target="_blank" rel="noopener noreferrer">Render</a>, <a href="https://www.cloudflare.com/privacypolicy/" target="_blank" rel="noopener noreferrer">Cloudflare</a> and <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">Google</a>. These notices supplement our responsibilities.</p>
      <h3>Retention and control</h3><p>Saved research is kept for your ongoing private-library purpose, without automatic expiry. You can delete threads and their messages from the library, and request a manual export or account deletion by email. There is no self-service account-deletion or complete-export button. Signing out or clearing browser storage does not delete server history.</p>
      <p>We review retention every six months and remove information when its purpose ends, applying any shorter legal requirement. This does not mean every thread expires six months after collection. Necessary legal duties or specific claims may justify restricted retention. Security/quota records are cleaned during normal operations and retention reviews; cleanup is not an automatic deletion guarantee during inactivity. We follow through on applicable provider requests and explain any remaining backup, security or legal retention.</p>
      <h3>Your rights</h3><p>Email <a href={`mailto:${content.privacyContact}`}>{content.privacyContact}</a> to request access, correction, a copy/export, deletion, restriction or to object to processing. Where processing relies on consent, you may withdraw it without affecting earlier lawful processing. We verify ownership through an existing account or verified contact channel, using proportionate alternatives where needed. Never send passwords, session tokens or excessive identity documents.</p>
      <p>We handle requests manually without unreasonable delay and apply the deadline relevant to the request. We coordinate with our processors and help with relevant provider-held records. If a specific legal exception limits action, we explain it and retain only what is necessary. You can complain directly to the <a href="https://services.ndpc.gov.ng/breach/" target="_blank" rel="noopener noreferrer">Nigeria Data Protection Commission</a> without contacting us first.</p>
      <p>Material changes will be brought to users’ attention before they apply where required. Research answers are not offered as automated decisions with legal or similarly significant effects.</p>
    </section>
    <section id="cookies" className="document-section legal-section"><h2>Cookies &amp; storage</h2>
      <p>There is no optional analytics, advertising or third-party video embed. Public pages can be read without an account. Nuelexity does not set application cookies for sign-in; the application uses browser storage as described below. If you choose a light or dark theme, that preference is saved in local storage on this device until you change it or clear site storage. Without an explicit choice, appearance follows your system preference and is not saved.</p>
      <p>{limited ? "When application features open, they will also use storage for the following functions:" : "Application features also use storage for these functions:"}</p>
      <ul className="storage-list"><li><strong>Eligibility and terms:</strong> a versioned self-declaration and terms acceptance in tab storage, including confirmation time, without a birth date or verified-age record.</li><li><strong>Sign-in:</strong> Supabase’s session and temporary sign-in verifier in local storage. Sign-out or a completed exchange removes the corresponding data as appropriate; a session otherwise persists until cleared or invalidated.</li><li><strong>Guest security:</strong> a short-lived, IP-bound pass in tab storage, reused while valid. Clearing it does not reset quotas. Turnstile may use storage in its own context when a guest workspace needs verification.</li><li><strong>Navigation and interface:</strong> tab-scoped thread identifiers, scroll positions, invitation dismissal and one-use sign-in return destination, without saved message text. Outgoing account pointers are cleared on account replacement/sign-out in open tabs. Browser tab restore may retain tab storage.</li></ul>
      <p>These uses support requested appearance, sign-in, security and interface functions. Clearing site storage resets those choices or signs you out; it does not erase saved server research. External identity and source sites have their own controls. Any future optional tracking needs separate review and prior consent where required; accepting terms does not supply that consent.</p>
    </section>
    <section id="terms" className="document-section legal-section"><h2>Terms</h2>
      <h3>Eligibility and access</h3><p>Public informational pages may be read without an account. Research and account use require you to be at least 18 and to have reached any higher applicable age of majority. Confirm eligibility and accept these terms before those actions. V1 has no child accounts, parental-consent registration or school deployments. {limited ? "In this public preview, research and sign-in are closed and the demonstration is prepared content." : "Guest research is temporary; signed-in users can keep private saved threads."}</p>
      <h3>A research project in beta</h3><p>Nuelexity is an independent learning project operated by {content.operator}, with limited free provider capacity. Guest and account use are subject to shared quotas and technical limits. Features can change, fail or be unavailable. An interrupted or failed attempt may consume allowance; requests are not automatically retried. The API’s free hosting may sleep, take time to start, restart or suspend service.</p>
      <h3>Use your judgement</h3><p>AI output and retrieved sources can be wrong, outdated, biased or incomplete. Citations help you inspect evidence and do not certify an answer. Verify important claims with original sources and qualified advice where appropriate.</p>
      <h3>Use the service responsibly</h3><p>Do not access someone else’s conversations, bypass quotas or bot checks, attack the service, submit unlawful content or infringe others’ rights. Do not submit passwords, API keys or other credentials, confidential information, sensitive personal information or children’s personal data. Do not submit other personal information you lack permission to share. These restrictions concern information you submit: ordinary general research about health, law, education or other topics is allowed when it does not disclose prohibited information. Access may be restricted to protect users and the service, including known underage use.</p>
      <h3>Your content and other people’s work</h3><p>You are responsible for what you submit and having the rights needed to do so. Asking a question permits the necessary service processing described here, including saved-library storage for signed-in research; it is not blanket consent for unrelated processing. You can stop using the service and request account deletion. Third-party pages, excerpts and trademarks belong to their rights holders; a citation does not grant a licence to republish them. Output may resemble other output and is not guaranteed to be exclusive.</p>
      <h3>Changes and applicable rights</h3><p>Changes will be recorded on this page. Nigerian law applies subject to mandatory protections that apply to you. Nothing here removes rights that cannot lawfully be waived, excludes the NDPC’s powers or prevents access to competent courts. Contact <a href={`mailto:${content.privacyContact}`}>{content.privacyContact}</a> about the service or these terms.</p>
    </section></PublicLayout>;
}

export function NotFound() {
  return <PublicLayout><section className="document-title"><p className="eyebrow">A SMALL DETOUR</p><BrandMark size={88} /><h1>This trail ends here.</h1><p>The page could not be found. Your next question is still welcome.</p><Link className="primary-link" to="/dashboard">Back to search ↗</Link></section></PublicLayout>;
}
