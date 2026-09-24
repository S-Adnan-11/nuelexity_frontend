import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { APITester } from "./APITester";
import "./index.css";
import {BrowserRouter, Route, Routes} from "react-router";
import Auth  from "./components/pages/Auth";
import Dahsboard from "./components/pages/Dashboard";
import logo from "./logo.svg";
import reactLogo from "./react.svg";

export function App() {
  return <BrowserRouter>
      <Routes>
            <Route path="/dashboard" element={<Dahsboard />} />
          <Route path="/auth" element={<Auth />} />
      </Routes>
  </BrowserRouter>
}

export default App;
