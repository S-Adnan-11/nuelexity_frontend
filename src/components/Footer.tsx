import { Link } from "react-router";
export function Footer({ compact = false }: { compact?: boolean }) {
  return <footer className={`site-footer ${compact ? "compact-footer" : ""}`}>
    <nav aria-label="About and legal">
      <Link to="/about">About Nuelexity</Link>
      <Link to="/legal#privacy">Privacy</Link>
      <Link to="/legal#cookies">Cookies &amp; storage</Link>
      <Link to="/legal#terms">Terms</Link>
    </nav>
  </footer>;
}
