// Krishnabuilds shared game chrome.
// Drop this one line into any game page to get a consistent top nav bar
// (with a "back to games" link) and a support link, with no per-game
// CSS or markup needed:
//
//   <script src="../../assets/game-embed.js" data-coffee-url="https://buymeacoffee.com/Krishnabuilds"></script>
//
// Optional data attributes on the <script> tag:
//   data-games-url  - where "All games" points (default: ../../index.html)
//   data-coffee-url - your Buy Me a Coffee (or similar) link
//   data-fullscreen - set to "landscape" to opt a game into fullscreen mode:
//     no navbar at all (replaced by a small floating circular back button,
//     top-left), and kbNavbarHeight/kbBottomReserve both report ~0. Pair
//     with window.kbEnterFullscreen(el) / window.kbExitFullscreen() below.
//
// The nav bar (top) and support link (bottom) take real screen space
// rather than floating over the game, so games that size a canvas to the
// viewport need to reserve room for both instead of measuring against the
// full window height. This script publishes both heights so a game can
// pick whichever's convenient:
//   - window.kbNavbarHeight / window.kbBottomReserve   (number, px)
//     read these in fitCanvas() and subtract both from window.innerHeight
//   - --kb-navbar-h / --kb-bottom-reserve               (CSS vars on <html>)
//     use in body { padding-top / padding-bottom }
// and fires a `kb-navbar-ready` event on window once all of the above are
// set, so a game can re-fit itself after the chrome (which loads after
// game markup) is actually in the DOM.
//
// Fullscreen mode also exposes:
//   window.kbEnterFullscreen(el) - call from inside a user-gesture click
//     handler (e.g. a Start button), before doing anything async. Requests
//     fullscreen on `el` and tries to lock landscape orientation. Both are
//     feature-detected and silently no-op where unsupported (iOS Safari
//     has no Fullscreen API at all - the game just runs as normal there).
//   window.kbExitFullscreen() - reverses both; call before navigating back
//     to the games list. Also runs automatically on 'fullscreenchange' if
//     the player exits some other way (Android back gesture, Esc), so
//     orientation lock never gets stuck.

(function () {
  const script = document.currentScript;
  const gamesUrl = (script && script.dataset.gamesUrl) || '../../index.html';
  const coffeeUrl = (script && script.dataset.coffeeUrl) || 'https://buymeacoffee.com/Krishnabuilds';
  const fullscreenMode = !!(script && script.dataset.fullscreen === 'landscape');

  window.kbEnterFullscreen = function (el) {
    try { (el || document.documentElement).requestFullscreen?.(); } catch (e) {}
    try { screen.orientation?.lock?.('landscape').catch(() => {}); } catch (e) {}
  };
  window.kbExitFullscreen = function () {
    try { document.exitFullscreen?.(); } catch (e) {}
    try { screen.orientation?.unlock?.(); } catch (e) {}
  };
  document.addEventListener('fullscreenchange', () => {
    if (!document.fullscreenElement) {
      try { screen.orientation?.unlock?.(); } catch (e) {}
    }
  });

  const style = document.createElement('style');
  style.textContent = `
    .kb-navbar {
      position: fixed;
      top: 0; left: 0; right: 0;
      z-index: 999;
      display: flex;
      align-items: center;
      justify-content: space-between;
      height: 64px;
      padding: 0 16px;
      background: #0a0f1a;
      border-bottom: 3px solid rgba(34,184,160,0.65);
      box-shadow: 0 4px 18px rgba(0,0,0,0.55);
      font-family: 'Inter', 'Segoe UI', Arial, sans-serif;
    }
    .kb-navbar::after {
      content: '';
      position: absolute;
      left: 0; right: 0; top: 100%;
      height: 56px;
      background: linear-gradient(180deg, rgba(10,15,26,0.65), rgba(10,15,26,0));
      pointer-events: none;
    }
    .kb-back {
      display: inline-flex;
      align-items: center;
      gap: 9px;
      text-decoration: none;
      color: #eef2f5;
      font-size: 17px;
      font-weight: 700;
      padding: 11px 20px;
      border-radius: 999px;
      background: rgba(255,255,255,0.09);
      border: 1.5px solid rgba(255,255,255,0.32);
      transition: background 0.15s ease, border-color 0.15s ease;
    }
    .kb-back:hover, .kb-back:active {
      background: rgba(34,184,160,0.22);
      border-color: rgba(34,184,160,0.7);
    }
    .kb-back svg { flex: none; }
    .kb-brand {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 12.5px;
      font-weight: 600;
      letter-spacing: 0.02em;
      color: rgba(238,242,245,0.5);
      white-space: nowrap;
    }
    .kb-coffee {
      position: fixed;
      z-index: 999;
      bottom: 10px; right: 10px;
      display: inline-flex;
      align-items: center;
      font-family: 'Inter', 'Segoe UI', Arial, sans-serif;
      font-size: 13px;
      font-weight: 600;
      text-decoration: none;
      color: #eef2f5;
      background: rgba(255,183,3,0.16);
      border: 1px solid rgba(255,183,3,0.55);
      backdrop-filter: blur(4px);
      padding: 6px 13px;
      border-radius: 999px;
      transition: background 0.15s ease, transform 0.15s ease;
      line-height: 1.4;
    }
    .kb-coffee:hover { background: rgba(255,183,3,0.32); transform: translateY(-1px); }
    @media (max-width: 480px) {
      .kb-navbar { height: 68px; }
      .kb-navbar::after { height: 64px; }
      .kb-back { font-size: 18px; padding: 12px 22px; }
      .kb-brand { display: none; }
    }
    /* Landscape games (short viewport height) get a slim strip instead of
       the full navbar - the fixed ~64-68px + ~54px bottom reserve that's a
       fine ~15% of a portrait viewport eats 30%+ of a landscape one,
       crushing the game's canvas scale. */
    .kb-navbar--landscape {
      height: 36px;
      padding: 0 10px;
    }
    .kb-navbar--landscape::after { height: 20px; }
    .kb-navbar--landscape .kb-back {
      font-size: 13px;
      padding: 5px 12px;
      gap: 6px;
    }
    .kb-navbar--landscape .kb-back svg { width: 14px; height: 14px; }
    .kb-navbar--landscape .kb-brand { display: none; }
    /* Fullscreen-mode games skip the navbar entirely - just a small,
       unobtrusive circular back button in the corner, like a typical
       mobile game's in-fullscreen back control. */
    .kb-fs-back {
      position: fixed;
      bottom: calc(10px + env(safe-area-inset-bottom, 0px));
      left: calc(10px + env(safe-area-inset-left, 0px));
      z-index: 999;
      width: 40px;
      height: 40px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #eef2f5;
      background: rgba(10,15,26,0.55);
      border: 1.5px solid rgba(255,255,255,0.35);
      backdrop-filter: blur(3px);
      text-decoration: none;
    }
    .kb-fs-back:active { background: rgba(34,184,160,0.4); }
  `;
  document.head.appendChild(style);

  const arrowSvg = '<svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M10 3L4 8l6 5"/></svg>';
  let navbar = null;

  if (fullscreenMode) {
    const fsBack = document.createElement('a');
    fsBack.href = gamesUrl;
    fsBack.className = 'kb-fs-back';
    fsBack.innerHTML = arrowSvg;
    fsBack.addEventListener('click', () => { window.kbExitFullscreen(); });
    document.body.appendChild(fsBack);
  } else {
    navbar = document.createElement('div');
    navbar.className = 'kb-navbar';

    const back = document.createElement('a');
    back.href = gamesUrl;
    back.className = 'kb-back';
    back.innerHTML = arrowSvg + '<span>All games</span>';
    navbar.appendChild(back);

    const brand = document.createElement('span');
    brand.className = 'kb-brand';
    brand.textContent = '🕹️ Krishnabuilds Arcade' + (window.KB_VERSION ? ' · v' + window.KB_VERSION : '');
    navbar.appendChild(brand);

    document.body.appendChild(navbar);
  }

  const coffee = document.createElement('a');
  coffee.href = coffeeUrl;
  coffee.target = '_blank';
  coffee.rel = 'noopener';
  coffee.className = 'kb-coffee';
  coffee.textContent = '☕ Support';
  document.body.appendChild(coffee);

  function publishChromeMetrics() {
    if (fullscreenMode) {
      // No navbar exists in this mode - just the small floating corner
      // button, which isn't worth reserving layout space for.
      window.kbNavbarHeight = 0;
      window.kbBottomReserve = 0;
      document.documentElement.style.setProperty('--kb-navbar-h', '0px');
      document.documentElement.style.setProperty('--kb-bottom-reserve', '0px');
      window.dispatchEvent(new Event('kb-navbar-ready'));
      return;
    }
    // Landscape games are typically much shorter viewports where the
    // portrait-tuned chrome sizes would crush the canvas scale - shrink the
    // navbar to a slim strip and let the coffee link float free with no
    // reserved space at all (it's already pointer-events-safe over the
    // game). Set the class before measuring so offsetHeight reflects it.
    const isLandscape = window.matchMedia('(orientation: landscape)').matches;
    navbar.classList.toggle('kb-navbar--landscape', isLandscape);

    const navH = navbar.offsetHeight;
    // Coffee link floats bottom:10px with its own height - reserve that
    // plus its offset plus a little breathing room, so it gets real space
    // below the game instead of overlapping whatever renders there. In
    // landscape it just floats over the game as a small corner badge.
    const bottomReserve = isLandscape ? 0 : (coffee.offsetHeight + 24);
    window.kbNavbarHeight = navH;
    window.kbBottomReserve = bottomReserve;
    document.documentElement.style.setProperty('--kb-navbar-h', navH + 'px');
    document.documentElement.style.setProperty('--kb-bottom-reserve', bottomReserve + 'px');
    window.dispatchEvent(new Event('kb-navbar-ready'));
  }
  publishChromeMetrics();
  window.addEventListener('resize', publishChromeMetrics);
  window.addEventListener('orientationchange', publishChromeMetrics);
})();

// Fire-and-forget play-count ping - once per actual play rather than once
// per page load, so retrying/replaying counts too. Every game's Start
// button relabels itself "Play Again"/"Retry" and is reused for replays
// (rather than a page reload), so a load-time ping alone only ever counted
// the first attempt. Any button that begins an actual play carries a
// `data-kb-play` attribute (see CLAUDE.md "Adding a new game") - a
// delegated click listener pings on those. Silently does nothing if the
// slug can't be determined or the API isn't reachable (e.g. the KV-backed
// worker endpoint isn't deployed yet) - a game must never fail to load or
// play because of this.
(function () {
  const match = location.pathname.match(/\/games\/([a-z0-9-]+)\//);
  if (!match) return;
  const slug = match[1];
  let lastPing = 0;
  function pingPlay() {
    const now = Date.now();
    if (now - lastPing < 500) return; // guards a stray double-fire from one click
    lastPing = now;
    fetch('/api/play/' + slug, { method: 'POST' }).catch(() => {});
  }
  document.addEventListener('click', (e) => {
    if (e.target.closest('[data-kb-play]')) pingPlay();
  });
})();
