import { lazy, Suspense } from "react";
import { useLocation } from "react-router";
import Auth from "./components/pages/Auth";
import Account from "./components/pages/Account";
import { AuthProvider } from "./components/AuthProvider";
import { WorkspaceSkeleton } from "./components/Brand";
const Dashboard = lazy(() => import("./components/pages/Dashboard"));
export default function PrivateApp() {
  const { pathname } = useLocation();
  return <AuthProvider>{pathname === "/auth" || pathname === "/auth/callback" ? <Auth /> : pathname === "/account" ? <Account /> : <Suspense fallback={<WorkspaceSkeleton />}><Dashboard /></Suspense>}</AuthProvider>;
}
