import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./styles.css";
import { getAuthenticatedRoles } from "./auth";
import { applyThemePreference, readCachedThemePreference } from "./theme";

const roles = getAuthenticatedRoles();
const hasProfileRole = roles.includes("client") || roles.includes("employee");
applyThemePreference(hasProfileRole ? readCachedThemePreference() : "light");

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
