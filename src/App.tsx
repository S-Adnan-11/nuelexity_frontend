import { Component, lazy, Suspense, type ReactNode } from "react";
import { BrowserRouter, Link, Route, Routes } from "react-router";
import Auth from "./components/pages/Auth";
import { BrandLogo, WorkspaceSkeleton } from "./components/Brand";

import Account from "./components/pages/Account";
import { About, Legal, NotFound } from "./components/pages/PublicPages";
import { RouteEffects } from "./components/RouteEffects";
import { AuthProvider } from "./components/AuthProvider";

// Public pages do not need the workspace, stream client or model-menu bundle.
const Dashboard = lazy(() => import("./components/pages/Dashboard"));
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
const workspace = <WorkspaceBoundary><Suspense fallback={<WorkspaceSkeleton />}><Dashboard /></Suspense></WorkspaceBoundary>;

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <RouteEffects /><Routes>
          <Route path="/" element={workspace} />
          <Route path="/dashboard/:conversationId?" element={workspace} />
          <Route path="/account" element={<Account />} />
          <Route path="/about" element={<About />} />
          <Route path="/legal" element={<Legal />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/auth/callback" element={<Auth />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
export default App;
