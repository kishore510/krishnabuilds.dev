#!/usr/bin/env node
// Dojo Duel balance harness. Not part of CI or lint: run it by hand after
// changing MOVES, POWER or AI_PRESETS.
//
//   node apps/arcade/scripts/dojo-duel-balance.mjs                 # every row, 60 matches each
//   node apps/arcade/scripts/dojo-duel-balance.mjs --matches 20 --rows jab-hard,good-hard --first-seed 2000
//   node apps/arcade/scripts/dojo-duel-balance.mjs --set hard.counterHits=4 --set hard.counterFrames=150
//   node apps/arcade/scripts/dojo-duel-balance.mjs --rows '*-turtle,*-zoner' --first-seed 2000
//
// It serves apps/arcade on a local port, opens games/dojo-duel in headless
// Chromium (Playwright), freezes the loop (dojoDuel.paused = true) and steps
// whole best-of-3 matches frame by frame with a scripted player, seeds 1000
// to 1000 + matches - 1 (or from --first-seed). The player bots press the same buttons a person
// would, through dojoDuel.press / hold; REN plays exactly as in the game.
// With 60 matches a row, expect about +/-7 points of noise.
//
// Bots:
//   jab / kick / sweep  walk in to the move's furthest reach and mash it (a press every 6 frames,
//                       about 10 a second, like a person hammering one button)
//   fireball            throws a fireball whenever it can afford one, otherwise stands
//   mid                 sees REN 14 frames late, blocks 50% of what it sees, punishes 35% of misses
//   good                sees REN 8 frames late, blocks 80%, punishes 60%
//
// --set table.key=value edits AI_PRESETS (easy.* / hard.* / rusher.* / turtle.* /
// zoner.* / sensei.*, and deeper, e.g. sensei.powerAi.fireballRange=200) or
// POWER.ai (ai.*) in the page before each row, for trying values without
// editing the game. --rows takes names or * patterns ("*-sensei", "good-*").

import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');   // apps/arcade

const ROWS = {
  'jab-easy':      { bot: 'jab',      mode: 'easy' },
  'jab-hard':      { bot: 'jab',      mode: 'hard' },
  'kick-hard':     { bot: 'kick',     mode: 'hard' },
  'sweep-hard':    { bot: 'sweep',    mode: 'hard' },
  'fireball-hard': { bot: 'fireball', mode: 'hard' },
  'mid-easy':      { bot: 'mid',      mode: 'easy' },
  'mid-hard':      { bot: 'mid',      mode: 'hard' },
  'good-easy':     { bot: 'good',     mode: 'easy' },
  'good-hard':     { bot: 'good',     mode: 'hard' }
};
// The challengers: every bot against each (rows like jab-sensei, good-zoner).
for (const mode of ['rusher', 'turtle', 'zoner', 'sensei']) {
  for (const bot of ['jab', 'kick', 'sweep', 'fireball', 'mid', 'good']) ROWS[bot + '-' + mode] = { bot, mode };
}
const LABEL = m => m[0].toUpperCase() + m.slice(1);

// --- args ---
const args = process.argv.slice(2);
let matches = 60, first = 1000, rowNames = Object.keys(ROWS), workers = 4;
const sets = [];
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === '--matches') matches = Number(args[++i]);
  else if (a === '--first-seed') first = Number(args[++i]);
  else if (a === '--rows') {
    // names, or patterns with * (e.g. "*-sensei", "good-*")
    rowNames = args[++i].split(',').flatMap(r => !r.includes('*') ? [r]
      : Object.keys(ROWS).filter(k => new RegExp('^' + r.replace(/\*/g, '.*') + '$').test(k)));
  }
  else if (a === '--workers') workers = Number(args[++i]);
  else if (a === '--set') {
    const [path, v] = args[++i].split('=');
    const [table, ...keys] = path.split('.');
    sets.push({ table, keys, value: JSON.parse(v) });
  } else { console.error('unknown argument ' + a); process.exit(1); }
}
for (const r of rowNames) if (!ROWS[r]) { console.error('unknown row ' + r + ' (rows: ' + Object.keys(ROWS).join(', ') + ')'); process.exit(1); }

// --- static server for apps/arcade ---
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png' };
const server = createServer(async (req, res) => {
  const path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^([/\\])+/, '');
  try {
    const body = await readFile(join(ROOT, path));
    res.writeHead(200, { 'content-type': TYPES[extname(path)] || 'application/octet-stream' });
    res.end(body);
  } catch { res.writeHead(404); res.end(); }
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}/games/dojo-duel/index.html`;

// --- one match, run entirely inside the page ---
// Returns { won, rounds: [playerRounds, cpuRounds] }.
function playMatch({ bot, mode, seed, sets }) {
  const D = window.dojoDuel;
  const { MOVES, BOXES, FS, POWER } = D;
  for (const s of sets) {
    let o = s.table === 'ai' ? POWER.ai : D.AI_PRESETS[s.table];
    for (const k of s.keys.slice(0, -1)) o = o[k] = o[k] || {};
    o[s.keys[s.keys.length - 1]] = s.value;
  }
  D.paused = true;
  D.mode = mode;
  D.seed = seed;
  D.startGame();
  const me = D.player, ren = D.cpu;

  // the bot's own seeded RNG (mulberry32), so a row is repeatable
  let a = (seed * 7919 + 17) >>> 0;
  const rnd = () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  // centre-to-centre reach of a move against a standing body (same rule as the game's AI)
  const reach = id => {
    const hb = MOVES[id].hitbox;
    const front = Math.max(...BOXES.stand.hurt.filter(b => b.y < hb.y + hb.h && hb.y < b.y + b.h).map(b => b.x + b.w / 2));
    return (hb.x + hb.w / 2 + front) * FS - 4;
  };
  const threat = id => (MOVES[id].hitbox.x + MOVES[id].hitbox.w / 2) * FS + 22 * FS + 24;

  const SKILL = { mid: { delay: 14, block: 0.5, punish: 0.35 }, good: { delay: 8, block: 0.8, punish: 0.6 } }[bot];
  const hist = [];
  const b = { seenN: 0, whiffN: 0, fbN: 0, blockUntil: 0, blockLow: false, think: 0, plan: null, planT: 0 };
  const keys = ['left', 'right', 'up', 'down', 'block'];
  let frames = 0;

  while (D.state === 'playing' && frames < 40000) {
    frames++;
    const live = D.match.phase === 'fight';
    const dx = ren.x - me.x, dist = Math.abs(dx), toward = dx >= 0 ? 'right' : 'left', away = dx >= 0 ? 'left' : 'right';
    const hold = {}, press = [];

    if (bot === 'jab' || bot === 'kick' || bot === 'sweep') {
      const id = bot;
      // presses toward the whole time (a crouch can't walk, so the sweep only crouches in reach)
      if (dist > reach(id)) hold[toward] = true;
      else { if (id === 'sweep') hold.down = true; else hold[toward] = true; if (frames % 6 === 0) press.push(MOVES[id].button); }
    } else if (bot === 'fireball') {
      if (me.energy >= POWER.fireball.cost) press.push('power1');
    } else {
      // mid / good: plays from a delayed view of REN
      hist.push({ x: ren.x, state: ren.state, move: ren.move && { id: ren.move.id, n: ren.move.n, frame: ren.move.frame, hit: ren.move.hit },
        fireballs: D.projectiles.filter(p => p.owner !== me.name).map(p => ({ x: p.x, vx: p.vx, n: p.n })) });
      if (hist.length > 64) hist.shift();
      const o = hist[Math.max(0, hist.length - SKILL.delay)];
      const odist = Math.abs(o.x - me.x);
      const m = o.move, def = m && MOVES[m.id];
      const phase = m && (m.frame < def.startup ? 'startup' : m.frame < def.startup + def.active ? 'active' : 'recovery');
      // see an attack coming: roll once to block it
      if (m && def.hitbox && phase !== 'recovery' && !m.hit && m.n !== b.seenN && odist < threat(m.id)) {
        b.seenN = m.n;
        if (rnd() < SKILL.block) { b.blockUntil = frames + def.startup + def.active + 4; b.blockLow = def.height === 'low'; b.plan = null; }
      }
      const fb = o.fireballs.find(p => Math.sign(me.x - p.x) === Math.sign(p.vx) && Math.abs(me.x - p.x) < 200);
      if (fb && fb.n !== b.fbN) {
        b.fbN = fb.n;
        if (rnd() < SKILL.block) { b.blockUntil = frames + Math.abs(me.x - fb.x) / Math.abs(fb.vx) + 4; b.blockLow = false; b.plan = null; }
      }
      // see an attack whiff: roll once to punish it
      if (m && def.hitbox && phase === 'recovery' && !m.hit && m.n !== b.whiffN) {
        b.whiffN = m.n;
        if (rnd() < SKILL.punish) { b.plan = dist <= reach('jab') ? 'jab' : 'kick'; b.planT = 12; }
      }
      if (frames < b.blockUntil || me.state === 'blockstun') {
        hold[away] = true;
        if (b.blockLow) hold.down = true;
      } else if (b.plan) {
        if (dist <= reach(b.plan)) { if (b.plan === 'sweep') hold.down = true; press.push(MOVES[b.plan].button); b.plan = null; }
        else if (--b.planT <= 0) b.plan = null;
        else hold[toward] = true;
      } else {
        // neutral: every 12 frames, walk in (from beyond 136 px), or poke 45% (jab half
        // the time, kick 30%, sweep 20%), step back 25%, or wait
        if (--b.think <= 0) {
          b.think = 12;
          const r = rnd();
          b.neutral = dist > 136 ? 'in' : r < 0.45 ? 'poke' : r < 0.7 ? 'back' : 'wait';
          if (b.neutral === 'poke') { const q = rnd(); b.plan = q < 0.5 ? 'jab' : q < 0.8 ? 'kick' : 'sweep'; b.planT = 12; }
        }
        if (b.neutral === 'in' && dist > 100) hold[toward] = true;
        if (b.neutral === 'back' && dist < 140) hold[away] = true;
      }
    }

    for (const k of keys) D.hold(k, !!hold[k]);
    D.step(1, live ? press : []);
  }
  for (const k of keys) D.hold(k, false);
  const w = D.match.wins;
  return { won: w[0] > w[1], rounds: w };
}

// --- run ---
const browser = await chromium.launch();
const pages = [];
for (let i = 0; i < workers; i++) {
  const page = await browser.newPage();
  page.on('pageerror', e => { console.error('page error: ' + e.message); process.exitCode = 1; });
  pages.push(page);
}
async function freshPage(page) {
  await page.goto(base);
  await page.waitForFunction(() => window.dojoDuel);
}

console.log(`Dojo Duel balance: ${matches} matches a row (seeds ${first}-${first + matches - 1})` + (sets.length ? ', with ' + sets.map(s => `${[s.table, ...s.keys].join('.')}=${JSON.stringify(s.value)}`).join(' ') : ''));
console.log('| Matchup | Player match wins | Player round wins |');
console.log('| --- | --- | --- |');
for (const name of rowNames) {
  const row = ROWS[name];
  await Promise.all(pages.map(freshPage));   // a clean page per row, so --set edits never leak between rows
  const seeds = Array.from({ length: matches }, (_, i) => first + i);
  const results = [];
  await Promise.all(pages.map(async page => {
    while (seeds.length) {
      const seed = seeds.shift();
      results.push(await page.evaluate(playMatch, { ...row, seed, sets }));
    }
  }));
  const won = results.filter(r => r.won).length;
  const pr = results.reduce((t, r) => t + r.rounds[0], 0), cr = results.reduce((t, r) => t + r.rounds[1], 0);
  const pct = n => Math.round(100 * n) + '%';
  console.log(`| ${row.bot} vs ${LABEL(row.mode)} | ${pct(won / results.length)} | ${pct(pr / (pr + cr))} |`);
}
await browser.close();
server.close();
