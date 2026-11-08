// Apply the saved theme before first paint to avoid a flash. Inlined into
// every page's <head> by scripts/build.mjs.
// Must stay in sync with packages/ui/src/theme.ts: cookie name `kb-theme`,
// stored values "light" and "dark" ("system" is never stored).
// test/prepaint.test.js fails if the two drift.
var kbTheme = document.cookie.match(/(?:^|; )kb-theme=(light|dark)(?:;|$)/);
if (kbTheme) document.documentElement.setAttribute("data-theme", kbTheme[1]);
