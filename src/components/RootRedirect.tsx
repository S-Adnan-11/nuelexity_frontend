import { Navigate } from "react-router";
import { useAuth } from "./AuthProvider";

export function RootRedirect() {
  const { loading } = useAuth();
  if (loading)
    return (
      <div className="loading-screen" role="status">
        Opening Nuelexity…
      </div>
    );
  // Guests now land in research too; sign-in is available when they want history.
  return <Navigate to="/dashboard" replace />;
}
