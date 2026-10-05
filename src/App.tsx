import { BrowserRouter, Navigate, Route, Routes } from "react-router";
import Auth from "./components/pages/Auth";
import Dashboard from "./components/pages/Dashboard";
import { RootRedirect } from "./components/RootRedirect";
import { AuthProvider } from "./components/AuthProvider";
import "./index.css";

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<RootRedirect />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/auth/callback" element={<Auth />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
export default App;
