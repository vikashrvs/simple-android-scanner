import { defineConfig } from "vite";

// Locally the app is served from "/". The GitHub Pages workflow sets VITE_BASE to "/<repo-name>/".
export default defineConfig({
  base: process.env.VITE_BASE || "/",
});
