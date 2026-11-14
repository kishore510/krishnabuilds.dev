import shared from "@krishnabuilds/config/eslint";
import { defineConfig } from "eslint/config";

const browser = {
  cancelAnimationFrame: "readonly",
  clearTimeout: "readonly",
  document: "readonly",
  Element: "readonly",
  fetch: "readonly",
  localStorage: "readonly",
  KeyboardEvent: "readonly",
  location: "readonly",
  navigator: "readonly",
  performance: "readonly",
  requestAnimationFrame: "readonly",
  ResizeObserver: "readonly",
  setTimeout: "readonly",
  URLSearchParams: "readonly",
  window: "readonly",
};

export default defineConfig(
  shared,
  {
    // Inlined into pages as classic <script>s.
    files: ["src/**/*.js", "engine/src/**/*.js", "hub/**/*.js"],
    languageOptions: { sourceType: "script", globals: browser },
  },
  {
    // The Cloudflare Worker: an ES module, not an inlined page script.
    files: ["src/worker.js"],
    languageOptions: { sourceType: "module", globals: { fetch: "readonly", Request: "readonly", Response: "readonly", URL: "readonly" } },
  },
  {
    files: ["scripts/**/*.mjs", "test/**/*.js"],
    languageOptions: { globals: { console: "readonly", process: "readonly", URL: "readonly", structuredClone: "readonly", Request: "readonly", Response: "readonly" } },
  },
);
