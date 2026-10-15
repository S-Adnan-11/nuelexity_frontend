import { Navigate } from "react-router";
import { useAuth } from "./AuthProvider";
import { WorkspaceSkeleton } from "./Brand";

export function RootRedirect() {
  const { loading } = useAuth();
  if (loading) return <WorkspaceSkeleton />;
  // Guests now land in research too; sign-in is available when they want history.
  return <Navigate to="/dashboard" replace />;
}
