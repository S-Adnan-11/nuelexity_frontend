import { StrictMode } from "react";
import { createRoot, hydrateRoot } from "react-dom/client";
import "./index.css";

if (document.readyState === "loading") await new Promise<void>(resolve => document.addEventListener("DOMContentLoaded", () => resolve(), { once: true }));
const elem = document.getElementById("root");
if (!elem) throw new Error("The app root is missing.");
try {
  const { App } = await import("./App");
  const app = (
    <StrictMode>
      <App />
    </StrictMode>
  );
  if (elem.dataset.prerenderedPublic === location.pathname && !import.meta.hot) hydrateRoot(elem, app);
  else {
    const root = import.meta.hot ? (import.meta.hot.data.root ??= createRoot(elem)) : createRoot(elem);
    root.render(app);
  }
} catch {
  if (elem.dataset.prerenderedPublic === location.pathname) {
    const notice = document.createElement("p");
    notice.setAttribute("role", "alert");
    notice.textContent = "Interactive features couldn’t start. Reload to try again; public information remains available.";
    elem.append(notice);
  } else {
    elem.setAttribute("role", "alert");
    elem.className = "workspace-pending";
    const logo = document.createElement("img");
    logo.src = "/brand/v2/logos/lockup-sage.svg";
    logo.width = 178; logo.height = 40; logo.alt = "Nuelexity";
    const notice = document.createElement("p");
    notice.textContent = "Nuelexity couldn't start due to configuration issues. Try refreshing the page.";
    const retry = document.createElement("button");
    retry.textContent = "Retry";
    retry.onclick = () => window.location.reload();
    elem.replaceChildren(logo, notice, retry);
  }
}
