import { Component, lazy, Suspense, type ReactNode } from "react";
import { BrowserRouter, Link, Route, Routes } from "react-router";
import { EligibilityGate } from "./components/EligibilityGate";
import { BrandLogo, WorkspaceSkeleton } from "./components/Brand";

import { About, Legal, NotFound } from "./components/pages/PublicPages";
import { RouteEffects } from "./components/RouteEffects";
import { initializeConfig } from "./lib/config";

// Private code, including the shared auth client, loads after the declaration.
const PrivateApp = lazy(async () => {
  await initializeConfig();
  return import("./PrivateApp");
});
class WorkspaceBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  override state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  override render() {
    if (this.state.failed) return <main className="workspace-pending" role="alert">
      <BrandLogo /><p>The workspace couldn’t load. Check your connection and reload to try again.</p>
      <button className="primary-link" onClick={() => window.location.reload()}>Reload workspace</button>{" "}
      <Link className="quiet-button" to="/about">About Nuelexity</Link>
    </main>;
    return this.props.children;
  }
}
const workspace = <WorkspaceBoundary><Suspense fallback={<WorkspaceSkeleton />}><PrivateApp /></Suspense></WorkspaceBoundary>;

export function App() {
  return (
    <BrowserRouter>
      <RouteEffects /><Routes>
        <Route path="/about" element={<About />} />
        <Route path="/legal" element={<Legal />} />
        <Route path="/" element={<EligibilityGate>{workspace}</EligibilityGate>} />
        <Route path="/dashboard/:conversationId?" element={<EligibilityGate>{workspace}</EligibilityGate>} />
        <Route path="/auth" element={<EligibilityGate>{workspace}</EligibilityGate>} />
        <Route path="/auth/callback" element={<EligibilityGate>{workspace}</EligibilityGate>} />
        <Route path="/account" element={<EligibilityGate>{workspace}</EligibilityGate>} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}
export default App;
