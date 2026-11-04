import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router";
import { About, Legal, NotFound, PublicHome, PublicInformation, Unavailable } from "./components/pages/PublicPages";
import { RouteEffects } from "./components/RouteEffects";
import "./index.css";
createRoot(document.getElementById("root")!).render(<StrictMode><BrowserRouter><PublicInformation value={true}><RouteEffects /><Routes>
  <Route path="/" element={<PublicHome />} /><Route path="/about" element={<About />} /><Route path="/legal" element={<Legal />} />
  <Route path="/dashboard/*" element={<Unavailable />} /><Route path="/auth/*" element={<Unavailable />} /><Route path="/account/*" element={<Unavailable />} />
  <Route path="*" element={<NotFound />} />
</Routes></PublicInformation></BrowserRouter></StrictMode>);
