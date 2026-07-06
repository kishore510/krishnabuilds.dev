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
//
// The nav bar takes real screen space rather than floating over the game,
// so games that size a canvas to the viewport need to reserve room for it
// instead of measuring against the full window height. This script
// publishes the bar's height two ways so a game can pick whichever's
// convenient:
//   - window.kbNavbarHeight        (number, px) - read this in fitCanvas()
//   - --kb-navbar-h                (CSS var on <html>) - use in padding-top
// and fires a `kb-navbar-ready` event on window once both are set, so a
// game can re-fit itself after the bar (which loads after game markup) is
// actually in the DOM.

(function () {
  const script = document.currentScript;
  const gamesUrl = (script && script.dataset.gamesUrl) || '../../index.html';
  const coffeeUrl = (script && script.dataset.coffeeUrl) || 'https://buymeacoffee.com/Krishnabuilds';

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
  `;
  document.head.appendChild(style);

  const navbar = document.createElement('div');
  navbar.className = 'kb-navbar';

  const back = document.createElement('a');
  back.href = gamesUrl;
  back.className = 'kb-back';
  back.innerHTML = '<svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M10 3L4 8l6 5"/></svg><span>All games</span>';
  navbar.appendChild(back);

  const brand = document.createElement('span');
  brand.className = 'kb-brand';
  brand.textContent = '🕹️ Krishnabuilds Arcade';
  navbar.appendChild(brand);

  document.body.appendChild(navbar);

  const coffee = document.createElement('a');
  coffee.href = coffeeUrl;
  coffee.target = '_blank';
  coffee.rel = 'noopener';
  coffee.className = 'kb-coffee';
  coffee.textContent = '☕ Support';
  document.body.appendChild(coffee);

  function publishNavbarHeight() {
    const h = navbar.offsetHeight;
    window.kbNavbarHeight = h;
    document.documentElement.style.setProperty('--kb-navbar-h', h + 'px');
    window.dispatchEvent(new Event('kb-navbar-ready'));
  }
  publishNavbarHeight();
  window.addEventListener('resize', publishNavbarHeight);
})();
