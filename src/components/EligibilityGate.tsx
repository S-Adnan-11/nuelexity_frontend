import { useState, type ReactNode } from "react";
import { Link } from "react-router";
import { BrandLogo } from "./Brand";
import { ThemeToggle } from "./ThemeToggle";
import { Footer } from "./Footer";
import { confirmEligibility, hasEligibility } from "../lib/eligibility";
export function EligibilityGate({ children }: { children: ReactNode }) {
  const [confirmed, setConfirmed] = useState(() => { try { return hasEligibility(sessionStorage); } catch { return false; } });
  const [adult, setAdult] = useState(false), [terms, setTerms] = useState(false);
  if (confirmed) return children;
  return <div className="eligibility-shell"><a className="skip-link" href="#page-content">Skip to content</a><header className="eligibility-header"><ThemeToggle /></header><main id="page-content" tabIndex={-1} className="eligibility-page"><div className="eligibility-content"><Link to="/about" aria-label="About Nuelexity"><BrandLogo /></Link>
    <h1>Before you begin.</h1>
    <p>Research and account use are for adults. Public information and the demonstration are available without confirming eligibility.</p>
    <form onSubmit={event => { event.preventDefault(); if (!adult || !terms) return; try { confirmEligibility(sessionStorage); } catch { /* Confirmation still applies in memory if storage is blocked. */ } setConfirmed(true); }}>
      <label><input type="checkbox" checked={adult} onChange={event => setAdult(event.target.checked)} required />I confirm I am at least 18 and have reached the age of majority where I live, if higher.</label>
      <label><input type="checkbox" checked={terms} onChange={event => setTerms(event.target.checked)} required /><span>I accept the <Link to="/legal#terms" target="_blank" rel="noopener noreferrer">Terms</Link>.</span></label>
      <p className="storage-notice">Nuelexity uses a security pass for bot protection. No optional analytics or advertising. <Link to="/legal#cookies">  Storage details</Link> · <Link to="/legal#privacy">Privacy</Link></p>
      <button type="submit" className="primary-link" disabled={!adult || !terms}>Continue</button>
    </form><Footer /></div></main></div>;
}
