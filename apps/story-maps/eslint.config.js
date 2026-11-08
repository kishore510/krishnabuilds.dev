import shared from "@krishnabuilds/config/eslint";
import { defineConfig } from "eslint/config";

const browser = {
  cancelAnimationFrame: "readonly",
  clearTimeout: "readonly",
  document: "readonly",
  Element: "readonly",
  performance: "readonly",
  requestAnimationFrame: "readonly",
  ResizeObserver: "readonly",
  setTimeout: "readonly",
  window: "readonly",
};

export default defineConfig(
  shared,
  {
    // Inlined into pages as classic <script>s.
    files: ["src/**/*.js", "engine/src/**/*.js"],
    languageOptions: { sourceType: "script", globals: browser },
  },
  {
    files: ["scripts/**/*.mjs", "test/**/*.js"],
    languageOptions: { globals: { console: "readonly", process: "readonly", URL: "readonly", structuredClone: "readonly" } },
  },
);
