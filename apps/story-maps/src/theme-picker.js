// The theme picker in the top bar: Classic (light), Night (dark) or Auto
// (follow the device). Inlined at the end of the hub and explore pages by
// scripts/build.mjs.
// kbSetTheme must stay in sync with setTheme in packages/ui/src/theme.ts: the
// shared `kb-theme` cookie on .krishnabuilds.dev, "system" never stored.
// test/prepaint.test.js fails if the two write different cookies.

/** @param {"light" | "dark" | "system"} theme */
function kbSetTheme(theme) {
  var attrs = ["Path=/", "SameSite=Lax"];
  attrs.push(theme === "system" ? "Max-Age=0" : "Max-Age=" + 60 * 60 * 24 * 365);
  if (location.hostname.endsWith("krishnabuilds.dev")) attrs.push("Domain=.krishnabuilds.dev");
  if (location.protocol === "https:") attrs.push("Secure");
  document.cookie = "kb-theme=" + theme + "; " + attrs.join("; ");
  if (theme === "system") document.documentElement.removeAttribute("data-theme");
  else document.documentElement.setAttribute("data-theme", theme);
}

if (typeof document.querySelectorAll === "function") {
  var kbCurrent = (document.cookie.match(/(?:^|; )kb-theme=(light|dark)(?:;|$)/) || [])[1] || "system";
  document.querySelectorAll("[data-kb-theme]").forEach(function (button) {
    var value = /** @type {"light" | "dark" | "system"} */ (button.getAttribute("data-kb-theme"));
    button.setAttribute("aria-pressed", String(value === kbCurrent));
    button.addEventListener("click", function () {
      kbSetTheme(value);
      document.querySelectorAll("[data-kb-theme]").forEach(function (other) {
        other.setAttribute("aria-pressed", String(other === button));
      });
    });
  });
}
