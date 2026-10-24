// Design tokens for krishnabuilds.dev.
//
// Plain objects only (no enums or other TS-only runtime syntax): Node runs
// this file directly by stripping types, and bundlers import it as-is.

// Layer 1: primitives. Raw values with no meaning attached.
export const primitives = {
  color: {
    white: "#ffffff",
    "gray-50": "#f8fafc",
    "gray-100": "#f1f5f9",
    "gray-200": "#e2e8f0",
    "gray-300": "#cbd5e1",
    "gray-400": "#94a3b8",
    "gray-500": "#64748b",
    "gray-600": "#475569",
    "gray-700": "#334155",
    "gray-800": "#1e293b",
    "gray-900": "#0f172a",
    "gray-950": "#020617",
    "blue-300": "#93c5fd",
    "blue-400": "#60a5fa",
    "blue-600": "#2563eb",
    "blue-700": "#1d4ed8",
    "red-400": "#f87171",
    "red-600": "#dc2626",
    "red-700": "#b91c1c",
  },
  space: {
    "0": "0",
    "1": "0.25rem",
    "2": "0.5rem",
    "3": "0.75rem",
    "4": "1rem",
    "6": "1.5rem",
    "8": "2rem",
    "12": "3rem",
    "16": "4rem",
  },
  font: {
    family: {
      sans: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
      mono: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
    },
    size: {
      xs: "0.75rem",
      sm: "0.875rem",
      md: "1rem",
      lg: "1.125rem",
      xl: "1.25rem",
      "2xl": "1.5rem",
      "3xl": "2rem",
    },
    weight: {
      regular: "400",
      medium: "500",
      semibold: "600",
      bold: "700",
    },
    lineHeight: {
      tight: "1.25",
      normal: "1.5",
    },
  },
  radius: {
    none: "0",
    sm: "0.25rem",
    md: "0.5rem",
    lg: "1rem",
    full: "9999px",
  },
} as const;

export type ColorPrimitive = keyof typeof primitives.color;

// Layer 2: semantic tokens. Each names a primitive colour per theme.
export const semantic = {
  color: {
    bg: { light: "white", dark: "gray-950" },
    surface: { light: "gray-50", dark: "gray-900" },
    text: { light: "gray-900", dark: "gray-50" },
    "text-muted": { light: "gray-600", dark: "gray-400" },
    border: { light: "gray-200", dark: "gray-700" },
    accent: { light: "blue-600", dark: "blue-400" },
    "accent-fg": { light: "white", dark: "gray-950" },
    danger: { light: "red-700", dark: "red-400" },
    "focus-ring": { light: "blue-600", dark: "blue-400" },
  },
} as const satisfies {
  color: Record<string, { light: ColorPrimitive; dark: ColorPrimitive }>;
};

export type Theme = "light" | "dark";
export type SemanticColor = keyof typeof semantic.color;
