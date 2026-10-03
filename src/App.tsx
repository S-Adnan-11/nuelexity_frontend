import { BrowserRouter, Route, Routes } from "react-router";
import Auth from "./components/pages/Auth";
import Dashboard from "./components/pages/Dashboard";
import { RootRedirect } from "./components/RootRedirect";
import "./index.css";

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<RootRedirect />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/auth" element={<Auth />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
