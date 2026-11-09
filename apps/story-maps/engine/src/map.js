// Story Maps engine, part 1: the map. Pure functions, no DOM, so the build
// and the tests can run them in Node.
//
// buildMap(story, basemap, art) turns a story's data into one SVG string plus
// the route legs the player animates. validate(story, basemap, art) lists any
// problems with the data. A new story is new data; nothing here is specific to
// one story.
//
// Performance rules (apps/story-maps/CLAUDE.md): no masks, no blur filters,
// modest decoration counts. Routes are revealed with dash arrays.

(function (SM) {
  "use strict";

  const r1 = (n) => Math.round(n * 10) / 10;

  /** Equirectangular projection: [lon, lat] -> [x, y] in map units. */
  function projector(projection) {
    const { lon0, lat0, unitsPerDegree: k } = projection;
    return ([lon, lat]) => [(lon - lon0) * k, (lat0 - lat) * k];
  }

  /** Small seeded generator, so decoration is the same on every load. */
  function seeded(seed) {
    let s = seed >>> 0;
    return () => {
      s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
      return s / 4294967296;
    };
  }

  /** A smooth curve through points (Catmull-Rom as cubic Béziers). */
  function smoothPath(points, closed) {
    const n = points.length;
    const at = (i) => (closed ? points[(i + n) % n] : points[Math.max(0, Math.min(n - 1, i))]);
    let d = `M${r1(points[0][0])} ${r1(points[0][1])}`;
    const segments = closed ? n : n - 1;
    for (let i = 0; i < segments; i++) {
      const [p0, p1, p2, p3] = [at(i - 1), at(i), at(i + 1), at(i + 2)];
      const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
      const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
      d += `C${r1(c1[0])} ${r1(c1[1])} ${r1(c2[0])} ${r1(c2[1])} ${r1(p2[0])} ${r1(p2[1])}`;
    }
    return closed ? `${d}Z` : d;
  }

  /** Calls fn(x, y) every `step` units along a polyline. */
  function walk(points, step, fn) {
    let carry = 0;
    for (let i = 0; i < points.length - 1; i++) {
      const [ax, ay] = points[i];
      const [bx, by] = points[i + 1];
      const len = Math.hypot(bx - ax, by - ay);
      let t = carry;
      for (; t < len; t += step) fn(ax + ((bx - ax) * t) / len, ay + ((by - ay) * t) / len);
      carry = t - len;
    }
  }

  // --- painted decoration -----------------------------------------------------

  function peak(x, y, h, color, shade) {
    const w = h * 0.9;
    const top = [x - w * 0.12, y - h];
    return (
      `<path d="M${r1(x - w)} ${r1(y)}L${r1(top[0])} ${r1(top[1])}L${r1(x + w * 0.35)} ${r1(y - h * 0.68)}L${r1(x + w)} ${r1(y)}Z" fill="${color}"/>` +
      `<path d="M${r1(top[0])} ${r1(top[1])}L${r1(x + w * 0.35)} ${r1(y - h * 0.68)}L${r1(x + w)} ${r1(y)}L${r1(x + w * 0.15)} ${r1(y)}Z" fill="${shade}" opacity=".55"/>` +
      `<path d="M${r1(top[0])} ${r1(top[1])}L${r1(x - w * 0.48)} ${r1(y - h * 0.52)}L${r1(x - w * 0.22)} ${r1(y - h * 0.58)}L${r1(x)} ${r1(y - h * 0.42)}L${r1(x + w * 0.2)} ${r1(y - h * 0.6)}L${r1(x + w * 0.35)} ${r1(y - h * 0.68)}Z" fill="#fff"/>`
    );
  }

  function hill(x, y, s, color) {
    return `<path d="M${r1(x - 6 * s)} ${r1(y)}Q${r1(x)} ${r1(y - 10 * s)} ${r1(x + 6 * s)} ${r1(y)}Z" fill="${color}" stroke="#7a4a1f" stroke-width=".6"/>`;
  }

  function tree(x, y, s, color) {
    return (
      `<path d="M${r1(x)} ${r1(y - 9 * s)}L${r1(x - 5 * s)} ${r1(y - 2 * s)}H${r1(x + 5 * s)}ZM${r1(x)} ${r1(y - 5 * s)}L${r1(x - 6.5 * s)} ${r1(y + 2 * s)}H${r1(x + 6.5 * s)}Z" fill="${color}"/>` +
      `<rect x="${r1(x - s)}" y="${r1(y + 2 * s)}" width="${r1(2 * s)}" height="${r1(3 * s)}" fill="#5a3516"/>`
    );
  }

  const place = (x, y, scale, inner, extra) =>
    `<g transform="translate(${r1(x)} ${r1(y)})${scale === 1 ? "" : ` scale(${scale})`}"${extra || ""}>${inner}</g>`;

  // --- the map ------------------------------------------------------------------

  /**
   * @returns {{ svg: string, legs: object[], places: Record<string, number[]>, overview: object, size: number[] }}
   */
  function buildMap(story, basemap, art) {
    const P = projector(basemap.projection);
    const pts = (list) => list.map(P);
    const out = [];
    const [W, H] = basemap.size;

    // Land outlines, closed at the map edge where `extend` says so.
    const shapeD = (shape) => {
      if (shape.closed) return smoothPath(pts(shape.points), true);
      const tail = pts(shape.extend || []).map(([x, y]) => `L${r1(x)} ${r1(y)}`).join("");
      return `${smoothPath(pts(shape.points), false)}${tail}Z`;
    };
    const lands = basemap.land.shapes.map(shapeD);
    const sea = basemap.sea;
    const land = basemap.land;

    out.push(
      "<defs>" +
        `<linearGradient id="sm-sea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${sea.top}"/><stop offset=".55" stop-color="${sea.middle}"/><stop offset="1" stop-color="${sea.bottom}"/></linearGradient>` +
        `<linearGradient id="sm-land" gradientUnits="userSpaceOnUse" x1="0" y1="${r1(H * 0.18)}" x2="0" y2="${r1(H * 0.94)}"><stop offset="0" stop-color="${land.top}"/><stop offset=".5" stop-color="${land.middle}"/><stop offset="1" stop-color="${land.bottom}"/></linearGradient>` +
        `<clipPath id="sm-landclip">${lands.map((d) => `<path d="${d}"/>`).join("")}</clipPath>` +
        "</defs>",
    );
    out.push(`<rect x="${-W * 1.5}" y="${-H * 1.3}" width="${W * 4}" height="${H * 3.7}" fill="url(#sm-sea)"/>`);

    // Waves.
    {
      const rand = seeded(basemap.waves.seed);
      let s = "";
      for (let i = 0; i < basemap.waves.count; i++) {
        const x = -W * 0.2 + rand() * W * 1.4;
        const y = -H * 0.03 + rand() * H * 1.09;
        s += `<path d="M${r1(x)} ${r1(y)}q3 -3 6 0t6 0" fill="none" stroke="${sea.wave}" stroke-width=".9" opacity="${r1(0.18 + rand() * 0.25)}"/>`;
      }
      out.push(`<g>${s}</g>`);
    }

    // Ships.
    for (const ship of basemap.ships || []) {
      const [x, y] = P(ship.at);
      out.push(place(x, y, ship.scale, art.glyphs.boat, ' opacity=".9"'));
    }

    // Shallows, then land.
    out.push(
      `<g fill="none" stroke-linejoin="round" stroke="${sea.shallows}">${lands
        .map((d) => `<path d="${d}" stroke-width="15" opacity=".25"/><path d="${d}" stroke-width="7" opacity=".35"/>`)
        .join("")}</g>`,
    );
    for (const d of lands) {
      out.push(`<path d="${d}" fill="url(#sm-land)" stroke="${land.edge}" stroke-width="1.6" stroke-linejoin="round"/>`);
    }

    // Colour washes and highlands, clipped to the land. Radial gradients, not blur.
    {
      let grads = "";
      let shapes = "";
      basemap.washes.forEach((w, n) => {
        const [x, y] = P(w.at);
        grads += `<radialGradient id="sm-wash${n}"><stop offset="0" stop-color="${w.color}" stop-opacity="${r1(Math.min(1, w.opacity * 1.25) * 100) / 100}"/><stop offset=".55" stop-color="${w.color}" stop-opacity="${r1(w.opacity * 70) / 100}"/><stop offset="1" stop-color="${w.color}" stop-opacity="0"/></radialGradient>`;
        shapes += `<ellipse cx="${r1(x)}" cy="${r1(y)}" rx="${r1(w.rx * 1.3)}" ry="${r1(w.ry * 1.3)}" fill="url(#sm-wash${n})"${w.rotate ? ` transform="rotate(${w.rotate} ${r1(x)} ${r1(y)})"` : ""}/>`;
      });
      let high = "";
      if (basemap.highlands) {
        const hl = basemap.highlands;
        const tail = pts(hl.extend).map(([x, y]) => `L${r1(x)} ${r1(y)}`).join("");
        const d = `${smoothPath(pts(hl.edge), false)}${tail}Z`;
        high = `<path d="${d}" fill="${hl.color}"/><path d="${d}" fill="#fff" opacity=".18" transform="translate(0 -6)"/>`;
      }
      out.push(`<g clip-path="url(#sm-landclip)"><defs>${grads}</defs>${shapes}${high}</g>`);
    }

    // Rivers and their labels.
    {
      let s = "";
      let labels = "";
      for (const river of basemap.rivers || []) {
        const d = smoothPath(pts(river.points), false);
        s += `<path d="${d}" fill="none" stroke="#2b7fb4" stroke-width="3.2" stroke-linecap="round" opacity=".5"/><path d="${d}" fill="none" stroke="#7cc3ea" stroke-width="1.8" stroke-linecap="round"/>`;
        if (river.label) {
          const [x, y] = P(river.label);
          labels += `<text class="sm-river-label" x="${r1(x)}" y="${r1(y)}">${esc(river.name)}</text>`;
        }
      }
      out.push(`<g>${s}</g>${labels}`);
    }

    // Mountain ranges and hills.
    {
      let s = "";
      for (const range of basemap.ranges || []) {
        const rand = seeded(range.seed);
        const line = pts(range.points);
        if (range.kind === "peaks") {
          const color = range.color || "#7f8ea6";
          const shade = range.shade || "#566684";
          walk(line, range.step, (x, y) => {
            s += peak(x + (rand() - 0.5) * 5, y + range.drop + rand() * 4, range.size[0] + rand() * range.size[1], color, shade);
          });
        } else {
          walk(line, range.step, (x, y) => {
            s += hill(x + (range.shift || 0), y + (rand() - 0.5) * (range.jitter || 0), range.size[0] + rand() * range.size[1], range.color);
          });
        }
      }
      out.push(`<g>${s}</g>`);
    }

    // Forests.
    if (basemap.forests) {
      const rand = seeded(basemap.forests.seed);
      const colors = basemap.forests.colors;
      let s = "";
      for (const c of basemap.forests.clusters) {
        const [cx, cy] = P(c.at);
        for (let i = 0; i < c.count; i++) {
          const a = rand() * Math.PI * 2;
          const dist = Math.sqrt(rand()) * c.radius;
          s += tree(cx + Math.cos(a) * dist, cy + Math.sin(a) * dist * 0.85, 0.7 + rand() * 0.35, colors[Math.floor(rand() * colors.length)]);
        }
      }
      out.push(`<g>${s}</g>`);
    }

    // Realms (kingdoms): painted loosely, shown only while active.
    if (story.realms) {
      let s = "";
      for (const realm of story.realms.items) {
        const d = smoothPath(pts(realm.area), true);
        const [lx, ly] = P(realm.label.at);
        const minor = realm.minor ? " minor" : "";
        s +=
          `<g class="sm-realm${minor}" data-id="${esc(realm.id)}">` +
          `<path class="sm-realm-shape" d="${d}" fill="${realm.color}" fill-opacity="${realm.minor ? ".24" : ".38"}" stroke="#2a1608" stroke-opacity="${realm.minor ? ".4" : ".55"}" stroke-width="${realm.minor ? "1.3" : "1.8"}" stroke-dasharray="${realm.minor ? "2 4" : "5 4"}" stroke-linejoin="round"/>` +
          `<text class="sm-realm-label${minor}" x="${r1(lx)}" y="${r1(ly)}" text-anchor="middle">${esc(realm.label.text)}</text></g>`;
      }
      out.push(`<g class="sm-realms">${s}</g>`);
    }

    // Sea and range labels, compass.
    for (const label of basemap.labels || []) {
      const [x, y] = P(label.at);
      out.push(`<text class="sm-${label.kind}-label" x="${r1(x)}" y="${r1(y)}">${esc(label.text)}</text>`);
    }
    if (basemap.compass) {
      const [x, y] = P(basemap.compass.at);
      out.push(place(x, y, 1, `${art.compass}<text class="sm-pin-label" x="0" y="-31" text-anchor="middle" style="font-size:9px">N</text>`, ' opacity=".8"'));
    }

    // Route legs: each step's legs, in order. Hidden until the player reveals them.
    const where = {};
    for (const [id, p] of Object.entries(story.places)) where[id] = P(p.at);
    const legs = [];
    let legSvg = "";
    story.steps.forEach((step, stepIndex) => {
      for (const leg of step.legs) {
        const a = where[leg.from];
        const b = where[leg.to];
        const dx = b[0] - a[0];
        const dy = b[1] - a[1];
        const len = Math.hypot(dx, dy) || 1;
        const cx = (a[0] + b[0]) / 2 - (dy / len) * len * leg.bend;
        const cy = (a[1] + b[1]) / 2 + (dx / len) * len * leg.bend;
        const d = `M${r1(a[0])} ${r1(a[1])}Q${r1(cx)} ${r1(cy)} ${r1(b[0])} ${r1(b[1])}`;
        const st = story.routeStyles[leg.style];
        const index = legs.length;
        legSvg +=
          `<g class="sm-leg" data-leg="${index}" style="visibility:hidden">` +
          `<path class="sm-leg-under" d="${d}" fill="none" stroke="#1b0f06" stroke-opacity=".6" stroke-width="${st.width + 3}" stroke-dasharray="${st.dash}" stroke-linecap="${st.cap}"/>` +
          `<path class="sm-leg-over" d="${d}" fill="none" stroke="${st.color}" stroke-width="${st.width}" stroke-dasharray="${st.dash}" stroke-linecap="${st.cap}"/></g>`;
        legs.push({ index, step: stepIndex, traveller: leg.traveller, dash: st.dash });
      }
    });
    out.push(`<g class="sm-legs">${legSvg}</g>`);

    // Pins.
    {
      const offsets = { right: [19, 4, "start"], left: [-19, 4, "end"], top: [0, -20, "middle"], bottom: [0, 28, "middle"] };
      let s = "";
      for (const [id, p] of Object.entries(story.places)) {
        if (p.hidden) continue;
        const [x, y] = where[id];
        const [lx, ly, anchor] = offsets[p.label || "right"];
        s += place(
          x,
          y,
          1,
          `<circle class="sm-pulse" r="15"/><circle class="sm-disc" r="14"/><g transform="scale(.92)">${art.glyphs[p.glyph]}</g>` +
            `<text class="sm-pin-label" x="${lx}" y="${ly}" text-anchor="${anchor}">${esc(p.name)}</text>`,
          ` class="sm-pin future" data-place="${esc(id)}" role="button" tabindex="0" aria-label="${esc(p.name)}: about this place"`,
        );
      }
      out.push(s);
    }

    // Effects tied to steps (for now: celebration lamps around a place).
    (story.effects || []).forEach((effect, n) => {
      if (effect.type !== "lamps") return;
      const [x, y] = where[effect.place];
      const ring = [[-18, -22], [0, -28], [18, -22], [30, -8]];
      out.push(
        place(x, y, 1, ring.map(([dx, dy]) => place(dx, dy, 1, art.lamp)).join(""), ` class="sm-effect sm-lamps" data-effect="${n}"`),
      );
    });

    // The traveller marker: one icon per traveller, the player shows one at a time.
    out.push(
      `<g class="sm-marker"><circle r="15" fill="rgba(255,209,102,.4)"/>${Object.entries(story.travellers)
        .map(([id, t]) => `<g data-traveller="${esc(id)}">${art.travellers[t.icon]}</g>`)
        .join("")}</g>`,
    );

    const ov = basemap.overview;
    const [ox, oy] = P(ov.at);
    return {
      svg: out.join(""),
      legs,
      places: where,
      overview: { x: ox, y: oy, w: ov.width * basemap.projection.unitsPerDegree },
      size: basemap.size,
    };
  }

  /** Camera for a step, in map units. */
  function cameraFor(step, basemap) {
    const [x, y] = projector(basemap.projection)(step.camera.at);
    return { x, y, w: step.camera.width * basemap.projection.unitsPerDegree };
  }

  // --- validation -----------------------------------------------------------------

  const CANVASES = ["geo", "earth-deep", "cosmic"];
  const SOURCES = ["Tradition", "Archaeology", "History"];
  const LABEL_SIDES = ["left", "right", "top", "bottom"];

  /** @returns {string[]} problems; empty when the data is usable. */
  function validate(story, basemap, art) {
    const problems = [];
    const need = (ok, msg) => {
      if (!ok) problems.push(msg);
    };
    const isLonLat = (v) => Array.isArray(v) && v.length === 2 && v.every((n) => typeof n === "number" && Number.isFinite(n));
    need(CANVASES.includes(story.canvas), `canvas must be one of ${CANVASES.join(", ")}`);
    need(story.canvas === "geo", `only the geo canvas is built so far, not ${story.canvas}`);
    need(story.basemap === basemap.id, `basemap ${story.basemap} does not match ${basemap.id}`);
    need(SOURCES.includes(story.source), `source must be ${SOURCES.join(" or ")}`);
    for (const key of ["title", "description", "mapLabel", "note"]) need(typeof story[key] === "string" && story[key].trim() !== "", `missing ${key}`);

    for (const [id, p] of Object.entries(story.places)) {
      need(isLonLat(p.at), `place ${id}: at must be [lon, lat]`);
      if (!p.hidden) {
        need(Boolean(art.glyphs[p.glyph]), `place ${id}: unknown glyph ${p.glyph}`);
        need(LABEL_SIDES.includes(p.label), `place ${id}: label must be ${LABEL_SIDES.join(", ")}`);
      }
    }
    for (const [id, t] of Object.entries(story.travellers)) need(Boolean(art.travellers[t.icon]), `traveller ${id}: unknown icon ${t.icon}`);

    let lastAt = -1;
    story.steps.forEach((s, i) => {
      const where = `step ${i + 1}`;
      need(Boolean(story.places[s.place]) && !story.places[s.place].hidden, `${where}: unknown place ${s.place}`);
      need(Boolean(story.phases[s.phase]), `${where}: unknown phase ${s.phase}`);
      need(typeof s.at === "number" && s.at > lastAt && s.at <= 100, `${where}: timeline position must rise and stay within 0 to 100`);
      lastAt = s.at;
      need(isLonLat(s.camera && s.camera.at) && s.camera.width > 0, `${where}: bad camera`);
      if (s.source !== undefined) need(SOURCES.includes(s.source), `${where}: source must be ${SOURCES.join(" or ")}`);
      for (const key of ["title", "text", "when"]) need(typeof s[key] === "string" && s[key].trim() !== "", `${where}: missing ${key}`);
      const words = (s.text || "").trim().split(/\s+/).length;
      need(words <= 60, `${where}: card is ${words} words; keep it to about 60 at most`);
      for (const leg of s.legs) {
        need(Boolean(story.places[leg.from]) && Boolean(story.places[leg.to]), `${where}: leg ${leg.from} to ${leg.to} names an unknown place`);
        need(Boolean(story.travellers[leg.traveller]), `${where}: unknown traveller ${leg.traveller}`);
        need(Boolean(story.routeStyles[leg.style]), `${where}: unknown route style ${leg.style}`);
      }
    });

    const last = story.steps.length - 1;
    for (const e of story.effects || []) {
      need(e.type === "lamps", `unknown effect ${e.type}`);
      need(Boolean(story.places[e.place]), `effect: unknown place ${e.place}`);
      need(e.steps.every((n) => Number.isInteger(n) && n >= 0 && n <= last), "effect: steps out of range");
    }
    if (story.realms) {
      const ids = new Set();
      for (const r of story.realms.items) {
        need(!ids.has(r.id), `realm ${r.id}: duplicate id`);
        ids.add(r.id);
        need(r.area.length >= 3 && r.area.every(isLonLat), `realm ${r.id}: area needs at least three [lon, lat] points`);
        need(r.active.every(([a, b]) => a >= 0 && b <= last && a <= b), `realm ${r.id}: active steps out of range`);
        need([...r.rulers, ...r.ties].every((x) => x.from >= 0 && x.from <= last), `realm ${r.id}: ruler or tie step out of range`);
      }
    }
    if (story.people) {
      const ids = new Set();
      need(typeof story.people.heading === "string" && story.people.heading.trim() !== "", "people: missing heading");
      for (const p of story.people.items) {
        need(!ids.has(p.id), `person ${p.id}: duplicate id`);
        ids.add(p.id);
        for (const key of ["name", "life", "role", "text"]) need(typeof p[key] === "string" && p[key].trim() !== "", `person ${p.id}: missing ${key}`);
        const words = (p.text || "").trim().split(/\s+/).length;
        need(words <= 60, `person ${p.id}: card is ${words} words; keep it to about 60 at most`);
        need(Array.isArray(p.steps) && p.steps.length > 0 && p.steps.every((n) => Number.isInteger(n) && n >= 0 && n <= last), `person ${p.id}: steps out of range`);
      }
    }
    return problems;
  }

  function esc(text) {
    return String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  Object.assign(SM, { buildMap, cameraFor, validate, smoothPath, seeded, projector, esc });
})((globalThis.StoryMap = globalThis.StoryMap || {}));
