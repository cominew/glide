// apps/dashboard/mountField.tsx

import { createRoot } from "react-dom/client";
import { StrictMode } from "react";
import App from "./App";

let mounted = false;

export function mountGlideField() {
  if (mounted) return;
  mounted = true;

  const root = document.getElementById("root");
  if (!root) return;

  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>
  );

  document
    .getElementById("field-layer")
    ?.classList.add("manifest");
}