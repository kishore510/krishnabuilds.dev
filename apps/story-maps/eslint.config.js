import shared from "@krishnabuilds/config/eslint";
import { defineConfig } from "eslint/config";

export default defineConfig(
  shared,
  {
    // Inlined into every page as a classic <script>.
    files: ["src/**/*.js"],
    languageOptions: { sourceType: "script", globals: { document: "readonly" } },
  },
  {
    files: ["scripts/**/*.mjs", "test/**/*.js"],
    languageOptions: { globals: { console: "readonly", process: "readonly", URL: "readonly" } },
  },
);
