// Theme preference: light, dark, or follow the OS ("system").
//
// Stored in a cookie on .krishnabuilds.dev so every subdomain shares it.
// Must stay in sync with the inline head script in apps/portal/index.html,
// which applies it before first paint: cookie name `kb-theme`, stored values
// "light" and "dark" ("system" is never stored; it clears the cookie).

export type Theme = "light" | "dark" | "system";

const COOKIE = "kb-theme";
const ONE_YEAR = 60 * 60 * 24 * 365;

function isTheme(value: string): value is Theme {
  return value === "light" || value === "dark" || value === "system";
}

export function getTheme(): Theme {
  for (const part of document.cookie.split("; ")) {
    const [name, value] = part.split("=");
    if (name === COOKIE && value && isTheme(value)) return value;
  }
  return "system";
}

export function setTheme(theme: Theme): void {
  const attrs = ["Path=/", "SameSite=Lax"];
  // "system" is the default, so clear the cookie rather than store it.
  attrs.push(theme === "system" ? "Max-Age=0" : `Max-Age=${ONE_YEAR}`);
  // Share across subdomains in production; leave it host-only on localhost.
  if (location.hostname.endsWith("krishnabuilds.dev")) {
    attrs.push("Domain=.krishnabuilds.dev");
  }
  // Browsers drop Secure cookies over plain http (e.g. a phone hitting the
  // dev server on the LAN), so only add it on https.
  if (location.protocol === "https:") attrs.push("Secure");
  document.cookie = `${COOKIE}=${theme}; ${attrs.join("; ")}`;

  // No data-theme means the tokens follow the OS setting.
  if (theme === "system") {
    document.documentElement.removeAttribute("data-theme");
  } else {
    document.documentElement.setAttribute("data-theme", theme);
  }
}
