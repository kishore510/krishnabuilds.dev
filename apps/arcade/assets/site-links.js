// Krishnabuilds site links: a link home to krishnabuilds.dev plus links to
// the other apps, with Arcade marked as the current one. Plain JS with no
// dependencies, because Arcade has no build step and can't use the React
// SiteLinks component in packages/ui.
//
// Styles live in a shadow root, so nothing here leaks into a game's CSS and
// a game's CSS can't restyle the links.
//
//   window.kbSiteLinks.bar(parent)  - slim bar in normal flow, prepended
//                                     to `parent`. The landing page gets it
//                                     with <script ... data-render="bar">
//                                     at the top of <body>.
//   window.kbSiteLinks.pill(parent) - small "krishnabuilds" pill that
//                                     expands to the links when tapped
//                                     (game pages, via game-embed.js)

(function () {
  const script = document.currentScript;

  // Must match the shared app list in packages/ui (src/apps.ts). Only live
  // and beta apps are linked, same as SiteLinks there.
  const APPS = [
    { name: 'Arcade', url: 'https://arcade.krishnabuilds.dev', status: 'live' },
    { name: 'Chalkline', url: 'https://chalkline.krishnabuilds.dev', status: 'live' },
    { name: 'Stickyard', url: 'https://stickyard.krishnabuilds.dev', status: 'building' },
    { name: 'Sumyard', url: 'https://sumyard.krishnabuilds.dev', status: 'live' },
  ];
  const CURRENT = 'Arcade';
  const HOME_URL = 'https://krishnabuilds.dev';

  const CSS = `
    :host {
      --kb-bg: #ffffff;
      --kb-text: #1a2230;
      --kb-muted: #5a6678;
      --kb-border: rgba(26,34,48,0.18);
      --kb-accent: #12806e;
      font-family: 'Inter', 'Segoe UI', Arial, sans-serif;
      font-size: 14px;
      line-height: 1.2;
    }
    @media (prefers-color-scheme: dark) {
      :host {
        --kb-bg: #0a0f1a;
        --kb-text: #eef2f5;
        --kb-muted: #8a97ab;
        --kb-border: rgba(255,255,255,0.22);
        --kb-accent: #22b8a0;
      }
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    nav { color: var(--kb-text); }
    ul { list-style: none; display: flex; flex-wrap: wrap; }
    a {
      display: inline-flex;
      align-items: center;
      min-height: 44px;
      min-width: 44px;
      padding: 0 10px;
      color: inherit;
      text-decoration: none;
      border-radius: 6px;
    }
    a:hover { text-decoration: underline; }
    a:focus-visible, button:focus-visible {
      outline: 2px solid var(--kb-accent);
      outline-offset: -2px;
    }
    a[aria-current="page"] {
      color: var(--kb-accent);
      font-weight: 700;
    }
    .home { font-weight: 700; }

    /* Bar */
    .bar {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0 4px;
      padding: 0 8px;
      background: var(--kb-bg);
      border-bottom: 1px solid var(--kb-border);
    }

    /* Pill */
    .pill-wrap { position: relative; display: inline-block; }
    button {
      display: inline-flex;
      align-items: center;
      min-height: 44px;
      padding: 0;
      font: inherit;
      color: var(--kb-text);
      background: none;
      border: 0;
      cursor: pointer;
      border-radius: 999px;
    }
    .pill-face {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 4px 10px;
      font-size: 12px;
      font-weight: 600;
      background: var(--kb-bg);
      border: 1px solid var(--kb-border);
      border-radius: 999px;
    }
    .panel {
      position: absolute;
      top: 100%;
      right: 0;
      min-width: 160px;
      padding: 4px;
      background: var(--kb-bg);
      border: 1px solid var(--kb-border);
      border-radius: 10px;
      box-shadow: 0 6px 20px rgba(0,0,0,0.35);
    }
    .pill-wrap.left .panel { right: auto; left: 0; }
    .pill-wrap.center .panel { right: auto; left: 50%; transform: translateX(-50%); }
    .pill-wrap.up .panel { top: auto; bottom: 100%; }
    .panel[hidden] { display: none; }
    .panel ul { flex-direction: column; }
    .panel a { display: flex; }
  `;

  function linksMarkup() {
    const items = APPS
      .filter((app) => app.status === 'live' || app.status === 'beta')
      .map((app) => {
        const current = app.name === CURRENT ? ' aria-current="page"' : '';
        return '<li><a href="' + app.url + '"' + current + '>' + app.name + '</a></li>';
      })
      .join('');
    return '<a class="home" href="' + HOME_URL + '">krishnabuilds</a><ul>' + items + '</ul>';
  }

  function makeHost() {
    // A custom tag name so no game's element selectors can match the host.
    const host = document.createElement('kb-site-links');
    const root = host.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = CSS;
    root.appendChild(style);
    return { host, root };
  }

  function bar(parent) {
    const { host, root } = makeHost();
    host.style.display = 'block';
    const nav = document.createElement('nav');
    nav.className = 'bar';
    nav.setAttribute('aria-label', 'krishnabuilds.dev');
    nav.innerHTML = linksMarkup();
    root.appendChild(nav);
    (parent || document.body).prepend(host);
    return host;
  }

  // opts.align: which edge of the pill the panel lines up with: 'right'
  // (default), 'left' or 'center'.
  // opts.up: true to open the panel above the pill (for bottom corners).
  function pill(parent, opts) {
    opts = opts || {};
    const { host, root } = makeHost();
    host.style.display = 'inline-block';
    const wrap = document.createElement('nav');
    wrap.className = 'pill-wrap' + (opts.align ? ' ' + opts.align : '') + (opts.up ? ' up' : '');
    wrap.setAttribute('aria-label', 'krishnabuilds.dev');

    const button = document.createElement('button');
    button.type = 'button';
    button.setAttribute('aria-expanded', 'false');
    button.setAttribute('aria-controls', 'kb-site-links-panel');
    button.innerHTML = '<span class="pill-face">krishnabuilds <span aria-hidden="true">▾</span></span>';

    const panel = document.createElement('div');
    panel.className = 'panel';
    panel.id = 'kb-site-links-panel';
    panel.hidden = true;
    panel.innerHTML = linksMarkup();

    function setOpen(open) {
      panel.hidden = !open;
      button.setAttribute('aria-expanded', String(open));
    }
    button.addEventListener('click', () => setOpen(panel.hidden));
    // Close on Escape or a tap anywhere else. Clicks inside the shadow root
    // are retargeted to the host, so this check covers the panel too.
    document.addEventListener('click', (e) => {
      if (!panel.hidden && !e.composedPath().includes(host)) setOpen(false);
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !panel.hidden) {
        setOpen(false);
        button.focus();
      }
    });

    wrap.appendChild(button);
    wrap.appendChild(panel);
    root.appendChild(wrap);
    (parent || document.body).appendChild(host);
    return host;
  }

  window.kbSiteLinks = { bar, pill };
  if (script && script.dataset.render === 'bar') bar(document.body);
})();
