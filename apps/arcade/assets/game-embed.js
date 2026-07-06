// Krishnabuilds shared game chrome.
// Drop this one line into any game page to get a consistent "back to games"
// link and a support link, with no per-game CSS or markup needed:
//
//   <script src="../../assets/game-embed.js" data-coffee-url="https://buymeacoffee.com/Krishnabuilds"></script>
//
// Optional data attributes on the <script> tag:
//   data-games-url  - where "All games" points (default: ../../index.html)
//   data-coffee-url - your Buy Me a Coffee (or similar) link

(function () {
  const script = document.currentScript;
  const gamesUrl = (script && script.dataset.gamesUrl) || '../../index.html';
  const coffeeUrl = (script && script.dataset.coffeeUrl) || 'https://buymeacoffee.com/Krishnabuilds';

  const style = document.createElement('style');
  style.textContent = `
    .kb-embed-link {
      position: fixed;
      z-index: 999;
      display: inline-flex;
      align-items: center;
      font-family: 'Inter', 'Segoe UI', Arial, sans-serif;
      font-size: 13px;
      font-weight: 600;
      text-decoration: none;
      color: #eef2f5;
      background: rgba(8,12,18,0.55);
      border: 1px solid rgba(255,255,255,0.22);
      backdrop-filter: blur(4px);
      padding: 6px 13px;
      border-radius: 999px;
      transition: background 0.15s ease, transform 0.15s ease;
      line-height: 1.4;
    }
    .kb-embed-link:hover { background: rgba(8,12,18,0.82); transform: translateY(-1px); }
    .kb-back {
      top: 10px; left: 10px;
      font-size: 15px;
      font-weight: 700;
      padding: 10px 18px;
      background: rgba(8,12,18,0.75);
      border-color: rgba(255,255,255,0.4);
      box-shadow: 0 3px 10px rgba(0,0,0,0.4);
      min-height: 24px;
    }
    .kb-back:active { background: rgba(8,12,18,0.95); transform: translateY(0); }
    .kb-coffee {
      bottom: 10px; right: 10px;
      background: rgba(255,183,3,0.16);
      border-color: rgba(255,183,3,0.55);
    }
    .kb-coffee:hover { background: rgba(255,183,3,0.32); }
    @media (max-width: 480px) {
      .kb-back { font-size: 16px; padding: 12px 20px; }
      .kb-coffee { font-size: 11px; padding: 5px 10px; }
    }
  `;
  document.head.appendChild(style);

  const back = document.createElement('a');
  back.href = gamesUrl;
  back.className = 'kb-embed-link kb-back';
  back.textContent = '\u2190 All games';
  document.body.appendChild(back);

  const coffee = document.createElement('a');
  coffee.href = coffeeUrl;
  coffee.target = '_blank';
  coffee.rel = 'noopener';
  coffee.className = 'kb-embed-link kb-coffee';
  coffee.textContent = '\u2615 Support';
  document.body.appendChild(coffee);
})();
