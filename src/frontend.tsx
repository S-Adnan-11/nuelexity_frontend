import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { initializeConfig } from "./lib/config";

const elem = document.getElementById("root");
if (!elem) throw new Error("The app root is missing.");
try {
  await initializeConfig();
  // Config must arrive before the shared Supabase client is created.
  const { App } = await import("./App");
  const root = import.meta.hot
    ? (import.meta.hot.data.root ??= createRoot(elem))
    : createRoot(elem);
  root.render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
} catch {
  elem.setAttribute("role", "alert");
  elem.textContent =
    "Nuelexity couldn't start. Check the public frontend configuration and refresh the page.";
}
