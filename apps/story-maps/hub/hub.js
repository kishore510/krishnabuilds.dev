// The Explore page (/explore/) in the browser: the atlas (the world in one
// year), the vertical timeline and Browse (filters, search, sort). The story
// cards are on the front page (hub/front.js). Inlined after hub/explore.js by scripts/build.mjs; reads the
// catalogue from the JSON in #sm-catalogue. Entries link to /explore/<id>/.

(function () {
  "use strict";

  var X = globalThis.Explore;
  var data = JSON.parse(document.getElementById("sm-catalogue").textContent);
  var REGIONS = data.regions;
  var E = data.entries;
  var STORIES = data.stories; // id -> { title, built }
  var BY = {};
  E.forEach(function (e) {
    BY[e.id] = e;
  });
  var LANE = {};
  REGIONS.forEach(function (r) {
    r.lanes.forEach(function (l) {
      LANE[l.id] = { id: l.id, title: l.title, region: r };
    });
  });
  var REGION = {};
  REGIONS.forEach(function (r) {
    REGION[r.id] = r;
  });
  var ON_TIMELINE = REGIONS.filter(function (r) {
    return r.lanes.length;
  });
  var KIND = { civilisation: "Civilisation", dynasty: "Dynasty or empire", event: "Event", legend: "Epic or legend", route: "Route", person: "Person", "deep-time": "Deep time", discovery: "Discovery" };
  var built = function (e) {
    return Boolean(e.story && STORIES[e.story] && STORIES[e.story].built);
  };
  var hue = function (regionId) {
    return "--hue:var(--sm-hue-" + REGION[regionId].hue + ")";
  };
  var esc = function (text) {
    return String(text).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  };
  var href = function (e) {
    return "/explore/" + e.id + "/";
  };
  // An entry with a chapter is part of a larger story map; link straight to its chapter.
  var mapHref = function (e) {
    return "/" + e.story + "/" + (e.chapter ? "#" + e.chapter : "");
  };

  // Per-viewer conveniences only; everything works without storage.
  var store = {
    get: function (k, d) {
      try {
        var v = localStorage.getItem(k);
        return v ? JSON.parse(v) : d;
      } catch {
        return d;
      }
    },
    set: function (k, v) {
      try {
        localStorage.setItem(k, JSON.stringify(v));
      } catch {
        /* storage blocked */
      }
    },
  };
  var explored = store.get("sm-explored", []).filter(function (id) {
    return BY[id];
  });
  // How far this device has read each story (hub/progress.js): i is the chapter
  // to continue from, m the furthest reached (both 0-based), n the chapters.
  var progress = store.get("sm-progress", {}) || {};

  // A tile's reading mark, only where there is a story map to read; opening an
  // entry's own page never ticks it, so a story map added later never looks read.
  // The story's own entry: "Chapter 3 of 16" while reading, "✓ You’ve read" at the end.
  // A chapter entry (Sumer in Mesopotamia): "✓ You’ve read" once that chapter is reached.
  // The same rules and words as the front-page cards (hub/front.js).
  var furthestOf = function (p) {
    return Math.max(Number(p.m) || 0, Number(p.i) || 0);
  };
  function storyMark(storyId) {
    var p = progress[storyId];
    if (!p || !(p.n > 1)) return null;
    if (furthestOf(p) >= p.n - 1) return { done: true, text: "✓ You’ve read" };
    return p.i > 0 ? { done: false, text: "Chapter " + (p.i + 1) + " of " + p.n } : null;
  }
  function readMark(e) {
    if (!built(e)) return null;
    if (!e.chapter) return storyMark(e.story);
    var p = progress[e.story];
    return p && p.n > 1 && furthestOf(p) >= e.chapter - 1 ? { done: true, text: "✓ You’ve read" } : null;
  }
  var markPill = function (mark) {
    return mark ? '<span class="sm-pill' + (mark.done ? " sm-pill--read" : "") + '">' + mark.text + "</span>" : "";
  };

  var $ = function (id) {
    return document.getElementById(id);
  };
  var scroller = $("sm-tl-scroller");
  var inner = $("sm-tl-inner");
  var guide = $("sm-tl-guide");
  var pill = $("sm-tl-pill");

  var B = X.bounds(E);
  var START = B.start;
  var END = B.end;
  var PADTOP = 26;
  var PADBOT = 70;
  var GUT = 58;
  var TOL = 30;
  var ZOOMS = [
    { s: 0.12, name: "Overview", tick: 500 },
    { s: 0.45, name: "Centuries", tick: 100 },
    { s: 0.9, name: "Close", tick: 50 },
    { s: 1.8, name: "Closer", tick: 25 },
  ];

  var allIds = ON_TIMELINE.map(function (r) {
    return r.id;
  });
  var saved = store.get("sm-regions", null);
  var state = {
    regions: new Set(
      Array.isArray(saved) && saved.some(function (id) { return REGION[id]; })
        ? saved.filter(function (id) { return REGION[id] && REGION[id].lanes.length; })
        : window.innerWidth < 720 ? ["india"] : allIds,
    ),
    zoom: 1,
    anchor: -250,
    flash: null,
    b: { region: "all", kind: "all", maps: false, sort: "date", q: "" },
  };

  var params = new URLSearchParams(location.search);
  var at = BY[params.get("at") || ""];
  if (at && at.lane && X.isDated(at)) {
    state.regions.add(at.region);
    state.anchor = at.kind === "event" ? at.from : (at.from + at.to) / 2;
    state.flash = at.id;
  }

  // Nothing to count on a first visit, so say nothing.
  // Story maps this device has read to the end, by the same rule as the ticks (storyMark).
  var storyIds = Object.keys(STORIES).filter(function (id) { return STORIES[id].built; });
  var readCount = storyIds.filter(function (id) { return (storyMark(id) || {}).done; }).length;
  if (readCount) $("sm-count").innerHTML = "<b>" + readCount + "</b> of " + storyIds.length + " story maps read";

  // ---------- Timeline ----------

  function visibleLanes() {
    var out = [];
    ON_TIMELINE.forEach(function (r) {
      if (state.regions.has(r.id)) r.lanes.forEach(function (l) { out.push(LANE[l.id]); });
    });
    return out;
  }

  function renderRegionChips() {
    var all = state.regions.size === ON_TIMELINE.length;
    $("sm-tl-regions").innerHTML =
      '<button type="button" class="sm-chip-btn" data-r="all" aria-pressed="' + all + '">All regions</button>' +
      ON_TIMELINE.map(function (r) {
        return '<button type="button" class="sm-chip-btn" data-r="' + r.id + '" aria-pressed="' + (!all && state.regions.has(r.id)) +
          '" style="' + hue(r.id) + '"><span class="sm-dot"></span>' + esc(r.title) + "</button>";
      }).join("");
  }

  $("sm-tl-regions").addEventListener("click", function (ev) {
    var b = ev.target.closest("[data-r]");
    if (!b) return;
    var r = b.dataset.r;
    var all = state.regions.size === ON_TIMELINE.length;
    if (r === "all") state.regions = new Set(allIds);
    else if (all) state.regions = new Set([r]);
    else {
      if (state.regions.has(r)) state.regions.delete(r);
      else state.regions.add(r);
      if (!state.regions.size) state.regions = new Set(allIds);
    }
    store.set("sm-regions", Array.from(state.regions));
    state.anchor = yearAtGuide();
    renderRegionChips();
    buildTimeline();
  });

  var geo = { s: 0.45, headerH: 0, guideY: 0 };
  var blocks = [];
  var lastKey = "";

  function yearAtGuide() {
    if (!geo.headerH) return state.anchor;
    return START + (scroller.scrollTop + geo.guideY - geo.headerH - PADTOP) / geo.s;
  }

  function tickLabel(y) {
    return y < 0 ? -y + " BCE" : y === 0 ? "1 CE" : String(y);
  }

  function buildTimeline() {
    var W = scroller.clientWidth;
    if (!W) return;
    var z = ZOOMS[state.zoom];
    var s = z.s;
    var ov = state.zoom === 0;
    var lanes = visibleLanes();
    var H = (END - START) * s + PADTOP + PADBOT;
    // Every slot is wide enough to read a name; lanes with side-by-side entries
    // get wider and the timeline scrolls sideways when they don't all fit.
    var SLOT = ov ? 66 : 128;

    var packed = lanes.map(function (l) {
      var dyn = E.filter(function (e) {
        return e.lane === l.id && X.isSpan(e);
      });
      var p = X.pack(dyn, { s: s, start: START, pad: PADTOP, minH: ov ? 5 : 30, tol: TOL });
      return { l: l, items: p.items, w: p.slots * SLOT, x: 0 };
    });
    var natural = packed.reduce(function (n, p) { return n + p.w; }, 0);
    var avail = W - GUT - 1;
    if (natural < avail) {
      var extra = Math.floor((avail - natural) / packed.length);
      packed.forEach(function (p) { p.w += extra; });
    }
    var x = 0;
    packed.forEach(function (p) {
      p.x = x;
      x += p.w;
    });

    var head = '<div class="sm-tl-head" style="width:' + (GUT + x) + 'px"><div class="sm-tl-corner" style="width:' + GUT + 'px"></div>';
    var gut = "";
    var bg = "";
    packed.forEach(function (p, i) {
      var first = i === 0 || lanes[i - 1].region.id !== p.l.region.id;
      head += '<div class="sm-tl-lane' + (first ? " sm-first" : "") + '" style="width:' + p.w + "px;" + hue(p.l.region.id) + '">' +
        '<span class="sm-tl-region">' + (first ? esc(p.l.region.short) : "&nbsp;") + '</span><span class="sm-tl-lanename">' + esc(p.l.title) + "</span></div>";
      bg += '<div class="sm-tl-bg' + (i % 2 ? " sm-alt" : "") + (first && i ? " sm-rstart" : "") + '" style="left:' + p.x + "px;width:" + p.w + 'px"></div>';
    });
    head += "</div>";
    for (var y = Math.ceil(START / z.tick) * z.tick; y <= END; y += z.tick) {
      var top = (y - START) * s + PADTOP;
      gut += '<div class="sm-tl-tick" style="top:' + top + 'px">' + tickLabel(y) + "</div>";
      bg += '<div class="sm-tl-line' + (y === 0 ? " sm-zero" : "") + '" style="top:' + top + 'px"></div>';
    }

    var nodes = [];
    packed.forEach(function (p) {
      p.items.forEach(function (it) {
        var w = p.w / it.n;
        nodes.push(blockHtml(it, p.x + it.k * w + 4, w - 8, ov));
      });
      if (ov) return;
      E.filter(function (e) {
        return e.lane === p.l.id && e.kind === "event";
      }).forEach(function (e) {
        var top = (e.from - START) * s + PADTOP - 13;
        nodes.push('<a class="sm-tl-event" href="' + href(e) + '" style="top:' + top + "px;left:" + (p.x + p.w - 4) + "px;max-width:" +
          Math.min(p.w - 8, 190) + "px;" + hue(e.region) + '" title="' + esc(e.name + ", " + X.rangeText(e)) + '">' + esc(e.name) + "</a>");
      });
    });

    inner.innerHTML = head +
      '<div class="sm-tl-body" style="height:' + H + 'px"><div class="sm-tl-gutter" style="width:' + GUT + "px;height:" + H + 'px">' + gut + "</div>" +
      '<div class="sm-tl-lanes" style="width:' + x + "px;height:" + H + 'px">' + bg + nodes.join("") + "</div></div>";

    geo.s = s;
    geo.headerH = inner.querySelector(".sm-tl-head").offsetHeight;
    geo.guideY = Math.round(geo.headerH + (scroller.clientHeight - geo.headerH) * 0.3);
    guide.style.top = geo.guideY + "px";
    blocks = Array.prototype.map.call(inner.querySelectorAll(".sm-blk"), function (el) {
      return { el: el, f: Number(el.dataset.f), t: Number(el.dataset.t) };
    });
    scroller.scrollTop = (state.anchor - START) * s + PADTOP + geo.headerH - geo.guideY;
    if (state.flash) {
      var hit = inner.querySelector('[data-id="' + state.flash + '"]');
      if (hit) {
        hit.classList.add("sm-flash");
        var left = hit.offsetLeft - GUT;
        if (left > scroller.clientWidth - 160) scroller.scrollLeft = left - 40;
      }
      state.flash = null;
    }
    $("sm-zoom-name").textContent = z.name;
    $("sm-zoom-out").disabled = state.zoom === 0;
    $("sm-zoom-in").disabled = state.zoom === ZOOMS.length - 1;
    lastKey = "";
    onScroll();
  }

  function blockHtml(it, left, w, ov) {
    var e = it.entry;
    var cls = "sm-blk" + (built(e) ? " sm-built" : "") + (ov ? " sm-ov" : "") + ((readMark(e) || {}).done ? " sm-seen" : "");
    var body;
    if (ov) body = it.h >= 26 && w >= 40 ? '<span class="sm-blk-name">' + esc(e.name) + "</span>" : "";
    else {
      body = '<span class="sm-blk-name">' + esc(e.name) + "</span>" +
        (it.h >= 54 ? '<span class="sm-blk-dates">' + X.rangeText(e) + "</span>" : "") +
        (built(e) && it.h >= 96 && w >= 70 ? '<span class="sm-blk-badge">Story map</span>' : "");
    }
    var style = "top:" + it.top + "px;left:" + left + "px;width:" + w + "px;height:" + it.h + "px;" + hue(e.region);
    var label = e.name + ", " + X.rangeText(e) + (built(e) ? ", story map ready" : "");
    var dataAttrs = ' data-id="' + e.id + '" data-f="' + e.from + '" data-t="' + e.to + '"';
    if (ov) {
      return '<button type="button" class="' + cls + '"' + dataAttrs + ' data-zoom="' + (e.from + e.to) / 2 + '" style="' + style +
        '" aria-label="' + esc("Zoom in to " + label) + '" title="' + esc(e.name) + '">' + body + "</button>";
    }
    return '<a class="' + cls + '" href="' + href(e) + '"' + dataAttrs + ' style="' + style + '" aria-label="' + esc(label) + '">' + body + "</a>";
  }

  var raf = 0;
  function onScroll() {
    if (raf) return;
    raf = requestAnimationFrame(function () {
      raf = 0;
      var y = yearAtGuide();
      state.anchor = y;
      var r = Math.round(y / 10) * 10;
      pill.textContent = "c. " + X.yearText(r === 0 ? 1 : r);
      blocks.forEach(function (b) {
        b.el.classList.toggle("sm-now", b.f <= y && b.t >= y);
      });
      var ids = new Set(visibleLanes().map(function (l) { return l.id; }));
      var now = E.filter(function (e) {
        return X.isSpan(e) && ids.has(e.lane) && e.from <= y && e.to >= y;
      });
      var key = now.map(function (e) { return e.id; }).join();
      if (key === lastKey) return;
      lastKey = key;
      $("sm-tl-now").innerHTML = '<span class="sm-now-label">At the line:</span>' + (now.length
        ? now.map(function (e) {
          return '<a href="' + href(e) + '" style="' + hue(e.region) + '"><span class="sm-dot"></span>' + esc(e.name) + "</a>";
        }).join("")
        : '<span class="sm-now-none">Nothing in these regions yet</span>');
    });
  }
  scroller.addEventListener("scroll", onScroll, { passive: true });
  scroller.addEventListener("click", function (ev) {
    var b = ev.target.closest("[data-zoom]");
    if (!b) return;
    state.zoom = 1;
    state.anchor = Number(b.dataset.zoom);
    buildTimeline();
  });
  function zoomBy(d) {
    var nz = Math.min(ZOOMS.length - 1, Math.max(0, state.zoom + d));
    if (nz === state.zoom) return;
    state.anchor = yearAtGuide();
    state.zoom = nz;
    buildTimeline();
  }
  $("sm-zoom-in").addEventListener("click", function () { zoomBy(1); });
  $("sm-zoom-out").addEventListener("click", function () { zoomBy(-1); });

  // Rebuild at most once a frame, and only when the size really changes.
  var rraf = 0;
  var lastW = 0;
  var lastH = 0;
  new ResizeObserver(function () {
    if (rraf) return;
    rraf = requestAnimationFrame(function () {
      rraf = 0;
      if (!scroller.clientWidth || (scroller.clientWidth === lastW && scroller.clientHeight === lastH)) return;
      lastW = scroller.clientWidth;
      lastH = scroller.clientHeight;
      state.anchor = yearAtGuide();
      buildTimeline();
    });
  }).observe(scroller);

  // ---------- Browse ----------

  // "New story maps": every finished map, newest first (the manifest's added), however old.
  // Catalogue entries without a finished map are placeholders, so they are never listed.
  var NEWEST = Object.keys(STORIES)
    .map(function (id) { return Object.assign({ id: id }, STORIES[id]); })
    .filter(function (s) { return s.built && s.added; })
    .sort(function (a, b) { return b.added.localeCompare(a.added); });
  // The New pill is only for maps finished in the last 45 days.
  var FRESH = NEWEST.filter(function (s) { return Date.now() - Date.parse(s.added + (s.added.length > 10 ? "Z" : "")) < 45 * 864e5; });
  var isFresh = function (storyId) {
    return FRESH.some(function (s) { return s.id === storyId; });
  };

  // Reads and likes per story, from the Worker (src/worker.js). Null until
  // loaded, and stays null where there is no API (a local preview): then
  // Browse offers no "Most read" or "Most liked" sort and cards show no counts.
  var STATS = null;
  var countOf = function (kind, storyId) {
    return (STATS && storyId && STATS[kind] && Number(STATS[kind][storyId])) || 0;
  };
  // The tile that carries a story's counts: the entry the story is about, or,
  // for a story with no entry of its own (Mesopotamia), its first chapter's.
  var COUNTED = {};
  E.forEach(function (e) {
    if (!built(e)) return;
    var cur = COUNTED[e.story];
    if (!cur || (cur.chapter || 0) > (e.chapter || 0)) COUNTED[e.story] = e;
  });

  var heart = function (storyId) {
    var reads = countOf("reads", storyId);
    var likes = countOf("likes", storyId);
    var text = [reads ? reads + (reads === 1 ? " read" : " reads") : "", likes ? "♥ " + likes : ""].filter(Boolean).join(" · ");
    return text ? '<span class="sm-pill sm-pill--stats">' + text + "</span>" : "";
  };
  if (globalThis.fetch) {
    fetch("/api/stats")
      .then(function (r) {
        if (!r.ok) throw new Error(String(r.status));
        return r.json();
      })
      .then(function (stats) {
        STATS = stats || {};
        renderBrowse();
      })
      .catch(function () {
        /* no API here: Browse works without likes */
      });
  }

  function storyCard(s) {
    var r = REGION[s.region];
    return '<li><a class="sm-entry-card" href="/' + s.id + '/"' + (r ? ' style="' + hue(r.id) + '"' : "") + ">" +
      '<span class="sm-entry-card__kicker"><span class="sm-dot"></span>' + (r ? esc(r.short) + " · " : "") + "Story map</span>" +
      '<span class="sm-entry-card__name">' + esc(s.title) + "</span>" +
      '<span class="sm-entry-card__dates">' + esc(s.era) + "</span>" +
      (function (tags) {
        return tags ? '<span class="sm-entry-card__tags">' + tags + "</span>" : "";
      })((isFresh(s.id) ? '<span class="sm-pill sm-pill--new">New</span>' : "") + heart(s.id) + markPill(storyMark(s.id))) + "</a></li>";
  }

  function card(e) {
    var r = REGION[e.region];
    // Only the entry a new map is about says New; entries that are a chapter of it don't.
    var isNew = built(e) && !e.chapter && isFresh(e.story);
    var map = !built(e) ? "" : e.chapter ? "Part of " + esc(STORIES[e.story].title) : "Story map";
    var tags = (map ? '<span class="sm-pill sm-pill--map">' + map + "</span>" : "") +
      (isNew ? '<span class="sm-pill sm-pill--new">New</span>' : "") +
      // A story's reads and likes show once: on the entry it is about (see COUNTED).
      (built(e) && COUNTED[e.story] === e ? heart(e.story) : "") +
      markPill(readMark(e));
    return '<li><a class="sm-entry-card" href="' + href(e) + '" style="' + hue(r.id) + '">' +
      '<span class="sm-entry-card__kicker"><span class="sm-dot"></span>' + esc(r.short) + " · " + KIND[e.kind] + "</span>" +
      '<span class="sm-entry-card__name">' + esc(e.name) + "</span>" +
      '<span class="sm-entry-card__dates">' + X.rangeText(e) + "</span>" +
      (tags ? '<span class="sm-entry-card__tags">' + tags + "</span>" : "") + "</a></li>";
  }

  function haystack(e) {
    return [e.name, e.native, REGION[e.region].title, e.lane && LANE[e.lane].title, KIND[e.kind], X.rangeText(e),
      e.story && STORIES[e.story] && STORIES[e.story].title, e.note, e.summary]
      .filter(Boolean).join(" ").toLowerCase();
  }

  var chipRow = function (label, attr, opts, current) {
    return '<div class="sm-chips" role="group" aria-label="' + label + '">' + opts.map(function (o) {
      return '<button type="button" class="sm-chip-btn" ' + attr + '="' + o[0] + '" aria-pressed="' + (current === o[0]) + '"' +
        (REGION[o[0]] ? ' style="' + hue(o[0]) + '"' : "") + ">" + (REGION[o[0]] ? '<span class="sm-dot"></span>' : "") + esc(o[1]) + "</button>";
    }).join("") + "</div>";
  };

  function renderBrowse() {
    var b = state.b;
    var q = b.q.trim().toLowerCase();
    var list = E.filter(function (e) {
      return (b.region === "all" || e.region === b.region) && (b.kind === "all" || e.kind === b.kind) &&
        (!b.maps || built(e)) && (!q || haystack(e).indexOf(q) >= 0);
    });
    var byDate = function (x, y) {
      return (X.isDated(x) ? x.from : 1e9) - (X.isDated(y) ? y.from : 1e9) || x.name.localeCompare(y.name);
    };
    // Most read and Most liked: entries by their story's count (the story's own entry before its chapters), the rest oldest first.
    var byCount = function (kind) {
      return function (x, y) {
        var cx = built(x) ? countOf(kind, x.story) : 0;
        var cy = built(y) ? countOf(kind, y.story) : 0;
        return cy - cx || (cx && x.story === y.story ? (x.chapter || 0) - (y.chapter || 0) : 0) || byDate(x, y);
      };
    };
    var sort = (b.sort === "liked" || b.sort === "read") && !STATS ? "date" : b.sort;
    list.sort(sort === "az" ? function (x, y) { return x.name.localeCompare(y.name); } : sort === "liked" ? byCount("likes") : sort === "read" ? byCount("reads") : byDate);
    var plain = b.region === "all" && b.kind === "all" && !b.maps && !q;
    var recent = explored.slice(0, 8).map(function (id) { return BY[id]; });
    var regionOpts = [["all", "All regions"]].concat(REGIONS.map(function (r) { return [r.id, r.title]; }));
    var kindOpts = [["all", "Everything"], ["civilisation", "Civilisations"], ["dynasty", "Dynasties & empires"], ["legend", "Epics & legends"], ["event", "Events"], ["route", "Routes"], ["person", "People"], ["discovery", "Discoveries"], ["deep-time", "Deep time"]];

    $("sm-browse-body").innerHTML =
      chipRow("Region", "data-br", regionOpts, b.region) +
      '<div class="sm-chips" role="group" aria-label="Kind">' + kindOpts.map(function (o) {
        return '<button type="button" class="sm-chip-btn" data-bk="' + o[0] + '" aria-pressed="' + (b.kind === o[0]) + '">' + o[1] + "</button>";
      }).join("") + '<button type="button" class="sm-chip-btn sm-chip-btn--maps" data-bm aria-pressed="' + b.maps + '">Story maps only</button></div>' +
      (plain && recent.length ? '<h2 class="sm-browse-h">Pick up where you left off</h2><ul class="sm-entry-row">' + recent.map(card).join("") + "</ul>" : "") +
      (plain && NEWEST.length ? '<h2 class="sm-browse-h">New story maps</h2><ul class="sm-entry-row">' + NEWEST.map(storyCard).join("") + "</ul>" : "") +
      '<div class="sm-browse-bar"><h2 class="sm-browse-h">' + (plain ? "Everything" : "Results") + ' <span class="sm-browse-n">' + list.length + "</span></h2>" +
      '<label class="sm-sort">Sort <select id="sm-sort"><option value="date"' + (sort === "date" ? " selected" : "") + '>Oldest first</option>' +
      '<option value="az"' + (sort === "az" ? " selected" : "") + ">A to Z</option>" +
      (STATS ? '<option value="read"' + (sort === "read" ? " selected" : "") + ">Most read</option>" +
        '<option value="liked"' + (sort === "liked" ? " selected" : "") + ">Most liked</option>" : "") + "</select></label></div>" +
      (list.length
        ? '<ul class="sm-entry-grid">' + list.map(card).join("") + "</ul>"
        : '<p class="sm-empty">' + (q ? "Nothing matches “" + esc(b.q.trim()) + "”. Try a civilisation, a dynasty, a region or a century, or clear a filter." : "Nothing here yet for these filters.") + "</p>") +
      '<p class="sm-browse-foot">Legends have no dates, so they are listed here rather than on the timeline.</p>';
  }

  $("sm-browse-body").addEventListener("click", function (ev) {
    var r = ev.target.closest("[data-br]");
    var k = ev.target.closest("[data-bk]");
    var m = ev.target.closest("[data-bm]");
    if (r) state.b.region = r.dataset.br;
    if (k) state.b.kind = k.dataset.bk;
    if (m) state.b.maps = !state.b.maps;
    if (r || k || m) renderBrowse();
  });
  $("sm-browse-body").addEventListener("change", function (ev) {
    if (ev.target.id === "sm-sort") {
      state.b.sort = ev.target.value;
      renderBrowse();
    }
  });
  $("sm-q").addEventListener("input", function (ev) {
    state.b.q = ev.target.value;
    renderBrowse();
  });

  // ---------- Atlas: the world in one year ----------
  // A flat map and a year. Every civilisation and empire alive that year shows
  // as a circle on its heartland (catalogue `at` and `radius`): never a border.
  // Only the map pans and zooms; labels are thinned so they never overlap.

  var WORLD = data.world;
  var AW = WORLD.size[0];
  var AH = WORLD.size[1];
  var DEG = WORLD.unitsPerDegree;
  var SPANS = E.filter(function (e) {
    return X.isSpan(e) && e.at;
  }).sort(function (x, y) {
    return y.radius - x.radius; // big first, so small circles sit on top
  });
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var atStage = $("sm-at-stage");
  var atMap = $("sm-at-map");
  var atRange = $("sm-at-range");
  var atCard = $("sm-at-card");
  var A = { ready: false, cam: null, year: -250, sel: null, nodes: {}, raf: 0, playing: false, nowKey: "", zoomed: false };
  var MIN_W = 150;
  var PLAY_ICON = '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true"><path d="M6 4l13 8-13 8z"/></svg>';
  var PAUSE_ICON = '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true"><path d="M6 4h4v16H6zM14 4h4v16h-4z"/></svg>';

  var clamp = function (v, lo, hi) {
    return Math.max(lo, Math.min(hi, v));
  };
  var yearLabel = function (y) {
    return X.yearText(y === 0 ? 1 : y);
  };
  var alive = function (e, y) {
    return e.from <= y && e.to >= y;
  };

  /** Keep the camera on the map: never past its edges, never closer than MIN_W. */
  function bounded(c) {
    var cw = atStage.clientWidth || 360;
    var ch = atStage.clientHeight || 480;
    var w = clamp(c.w, MIN_W, AW);
    var h = (w * ch) / cw;
    return {
      w: w,
      x: w >= AW ? AW / 2 : clamp(c.x, w / 2, AW - w / 2),
      y: h >= AH ? AH / 2 : clamp(c.y, h / 2, AH - h / 2),
    };
  }
  function atlasDraw() {
    if (A.raf) return;
    A.raf = requestAnimationFrame(atlasRender);
  }
  function setCam(c) {
    A.cam = bounded(c);
    atlasDraw();
  }
  /** Zoom by a factor, keeping the map point under stage pixel (px, py) still. */
  function zoomAt(factor, px, py) {
    var cw = atStage.clientWidth;
    var ch = atStage.clientHeight;
    var c = A.cam;
    var upp = c.w / cw;
    var mx = c.x + (px - cw / 2) * upp;
    var my = c.y + (py - ch / 2) * upp;
    var w = clamp(c.w * factor, MIN_W, AW);
    var upp2 = w / cw;
    setCam({ w: w, x: mx - (px - cw / 2) * upp2, y: my - (py - ch / 2) * upp2 });
  }

  function atlasInit() {
    if (A.ready) return;
    A.ready = true;
    var blobs = "";
    var labels = "";
    SPANS.forEach(function (e) {
      var x = (e.at[0] - WORLD.lon0) * DEG;
      var y = (WORLD.lat0 - e.at[1]) * DEG;
      A.nodes[e.id] = { x: x, y: y, r: e.radius * DEG, on: false, blob: null, label: null, shown: false };
      blobs += '<circle class="sm-at-blob' + (built(e) ? " sm-built" : "") + '" data-id="' + e.id + '" cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) +
        '" r="' + (e.radius * DEG).toFixed(1) + '" style="' + hue(e.region) + '"/>';
      labels += '<text class="sm-at-label" data-id="' + e.id + '" text-anchor="middle">' + esc(e.name) + "</text>";
    });
    $("sm-at-blobs").innerHTML = blobs;
    $("sm-at-labels").innerHTML = labels;
    Array.prototype.forEach.call($("sm-at-blobs").children, function (n) { A.nodes[n.dataset.id].blob = n; });
    Array.prototype.forEach.call($("sm-at-labels").children, function (n) { A.nodes[n.dataset.id].label = n; });

    atRange.min = String(START);
    atRange.max = String(END);
    var ticks = "";
    for (var y = Math.ceil(START / 1000) * 1000; y <= END; y += 1000) {
      ticks += '<span style="left:' + (((y - START) / (END - START)) * 100).toFixed(2) + '%">' + tickLabel(y) + "</span>";
    }
    $("sm-at-ticks").innerHTML = ticks;

    // Phones open on India with the Mediterranean and China at the edges; wide screens on most of the world.
    var cw = atStage.clientWidth || 360;
    var ch = atStage.clientHeight || 480;
    var w = Math.max(600, (AH * cw) / ch);
    A.cam = bounded({ w: w, x: ((w < 900 ? 60 : 15) - WORLD.lon0) * DEG, y: AH / 2 });
    $("sm-at-play").innerHTML = PLAY_ICON;
  }

  function setYear(y) {
    A.year = clamp(Math.round(y / 10) * 10, START, END);
    state.anchor = A.year;
    if (Number(atRange.value) !== A.year) atRange.value = String(A.year);
    atlasDraw();
  }

  function atlasRender() {
    A.raf = 0;
    var cw = atStage.clientWidth;
    var ch = atStage.clientHeight;
    if (!cw || !A.cam) return;
    var c = A.cam;
    var upp = c.w / cw;
    var h = ch * upp;
    var left = c.x - c.w / 2;
    var top = c.y - h / 2;
    atMap.setAttribute("viewBox", left.toFixed(1) + " " + top.toFixed(1) + " " + c.w.toFixed(1) + " " + h.toFixed(1));
    // When the whole height fits, an up or down drag scrolls the page; zoomed in, the map takes every drag.
    var zoomed = h < AH - 1;
    if (zoomed !== A.zoomed) {
      A.zoomed = zoomed;
      atMap.classList.toggle("sm-zoomed", zoomed);
    }

    var y = A.year;
    var active = [];
    SPANS.forEach(function (e) {
      var n = A.nodes[e.id];
      var on = alive(e, y);
      if (on !== n.on) {
        n.on = on;
        n.blob.classList.toggle("sm-on", on);
      }
      if (!on) {
        if (n.shown) {
          n.shown = false;
          n.label.classList.remove("sm-on");
        }
        return;
      }
      // Small kingdoms stay big enough to see and to tap.
      n.r = Math.max(e.radius * DEG, 7 * upp);
      n.blob.setAttribute("r", n.r.toFixed(1));
      active.push(e);
    });

    // Labels: the selected one, then story maps, then the biggest; skip any that would overlap.
    var fs = 12.5 * upp;
    $("sm-at-labels").setAttribute("font-size", fs.toFixed(2));
    var placed = [];
    active.slice().sort(function (p, q) {
      return (q === A.sel) - (p === A.sel) || built(q) - built(p) || q.radius - p.radius;
    }).forEach(function (e) {
      var n = A.nodes[e.id];
      var w = e.name.length * fs * 0.56 + fs;
      var inside = n.r * 2 > w;
      var ly = inside ? n.y + fs * 0.35 : n.y + n.r + fs * 1.05;
      // A name near the edge slides inwards rather than being cut off.
      var lx = c.w > w ? clamp(n.x, left + w / 2, left + c.w - w / 2) : n.x;
      var box = { l: lx - w / 2, r: lx + w / 2, t: ly - fs, b: ly + fs * 0.4 };
      var ok = n.x > left && n.x < left + c.w && n.y > top && n.y < top + h && !placed.some(function (b) {
        return box.l < b.r && box.r > b.l && box.t < b.b && box.b > b.t;
      });
      if (ok) {
        placed.push(box);
        n.label.setAttribute("x", lx.toFixed(1));
        n.label.setAttribute("y", ly.toFixed(1));
      }
      if (ok !== n.shown) {
        n.shown = ok;
        n.label.classList.toggle("sm-on", ok);
      }
    });

    $("sm-at-year").textContent = yearLabel(y);
    atRange.setAttribute("aria-valuetext", yearLabel(y));
    var key = active.map(function (e) { return e.id; }).join();
    if (key !== A.nowKey) {
      A.nowKey = key;
      var byRegion = active.slice().sort(function (p, q) {
        return REGIONS.indexOf(REGION[p.region]) - REGIONS.indexOf(REGION[q.region]) || p.from - q.from;
      });
      $("sm-at-now").innerHTML = '<span class="sm-now-label">' + (active.length ? active.length + " on the map:" : "") + "</span>" + (active.length
        ? byRegion.map(function (e) {
          return '<button type="button" data-id="' + e.id + '" style="' + hue(e.region) + '"><span class="sm-dot"></span>' + esc(e.name) + "</button>";
        }).join("")
        : '<span class="sm-now-none">Nothing in the catalogue for this year yet</span>');
      if (A.sel && !alive(A.sel, y)) atlasSelect(null);
    }
  }

  /** Show an entry's card and mark its circle; `reveal` also brings it into view. */
  function atlasSelect(e, reveal) {
    if (A.sel) A.nodes[A.sel.id].blob.classList.remove("sm-sel");
    A.sel = e;
    atCard.hidden = !e;
    if (!e) return atlasDraw();
    var n = A.nodes[e.id];
    n.blob.classList.add("sm-sel");
    var next = X.neighbours(e, E).after;
    atCard.style.cssText = hue(e.region);
    atCard.innerHTML =
      '<button type="button" class="sm-at-close" data-close aria-label="Close">×</button>' +
      '<p class="sm-at-kicker"><span class="sm-dot"></span>' + esc(REGION[e.region].short) + " · " + KIND[e.kind] + "</p>" +
      '<h3><a href="' + href(e) + '">' + esc(e.name) + "</a></h3>" +
      '<p class="sm-at-dates">' + X.rangeText(e) + "</p>" +
      '<p class="sm-at-summary">' + esc(e.summary) + "</p>" +
      '<div class="sm-at-links">' +
      (built(e) ? '<a class="sm-btn sm-btn--primary" href="' + mapHref(e) + '">' + (e.chapter ? "Open at its chapter" : "Open the story map") + "</a>" : "") +
      '<a class="sm-btn" href="' + href(e) + '">Read more</a>' +
      (next && next.at ? '<button type="button" class="sm-btn" data-next="' + next.id + '">Next here: ' + esc(next.name) + " →</button>" : "") +
      "</div>";
    if (reveal) {
      var cw = atStage.clientWidth;
      var ch = atStage.clientHeight;
      var upp = A.cam.w / cw;
      var dx = Math.abs(n.x - A.cam.x) / upp;
      var dy = (n.y - A.cam.y) / upp;
      // Out of view, or under the card at the bottom: centre it in the upper part of the map.
      if (dx > cw / 2 - 30 || dy < -ch / 2 + 30 || dy > ch * 0.1) A.cam = bounded({ w: A.cam.w, x: n.x, y: n.y + ch * 0.15 * upp });
    }
    atlasDraw();
  }

  /** The smallest circle under a stage point, with a little slack for fingers. */
  function atlasPick(clientX, clientY) {
    var box = atStage.getBoundingClientRect();
    var upp = A.cam.w / box.width;
    var mx = A.cam.x + (clientX - box.left - box.width / 2) * upp;
    var my = A.cam.y + (clientY - box.top - box.height / 2) * upp;
    var best = null;
    SPANS.forEach(function (e) {
      var n = A.nodes[e.id];
      if (!n.on) return;
      if (Math.hypot(n.x - mx, n.y - my) <= n.r + 8 * upp && (!best || n.r < A.nodes[best.id].r)) best = e;
    });
    return best;
  }

  // Drag to pan, pinch to zoom, tap a circle. One finger moving up or down
  // scrolls the page until the map is zoomed in (touch-action in explore.css).
  var ptrs = new Map();
  var gesture = null;
  var dragged = false;
  function startGesture() {
    gesture = { cam: A.cam, pts: Array.from(ptrs.values()).map(function (p) { return { x: p.x, y: p.y }; }) };
  }
  atMap.addEventListener("pointerdown", function (ev) {
    if (!ptrs.size) dragged = false;
    ptrs.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
    try {
      atMap.setPointerCapture(ev.pointerId);
    } catch {
      /* no capture: the drag still works while the pointer stays on the map */
    }
    startGesture();
  });
  atMap.addEventListener("pointermove", function (ev) {
    var p = ptrs.get(ev.pointerId);
    if (!p || !gesture) return;
    p.x = ev.clientX;
    p.y = ev.clientY;
    var now = Array.from(ptrs.values());
    var was = gesture.pts;
    if (now.length !== was.length) return;
    var box = atStage.getBoundingClientRect();
    var upp = gesture.cam.w / box.width;
    if (now.length === 1) {
      var dx = now[0].x - was[0].x;
      var dy = now[0].y - was[0].y;
      if (Math.abs(dx) + Math.abs(dy) > 6) dragged = true;
      if (dragged) setCam({ w: gesture.cam.w, x: gesture.cam.x - dx * upp, y: gesture.cam.y - dy * upp });
      return;
    }
    dragged = true;
    var mid = function (l) {
      return { x: (l[0].x + l[1].x) / 2 - box.left - box.width / 2, y: (l[0].y + l[1].y) / 2 - box.top - box.height / 2 };
    };
    var spread = function (l) {
      return Math.max(20, Math.hypot(l[0].x - l[1].x, l[0].y - l[1].y));
    };
    var m0 = mid(was);
    var m1 = mid(now);
    var w = clamp((gesture.cam.w * spread(was)) / spread(now), MIN_W, AW);
    var upp2 = w / box.width;
    setCam({ w: w, x: gesture.cam.x + m0.x * upp - m1.x * upp2, y: gesture.cam.y + m0.y * upp - m1.y * upp2 });
  });
  function endPointer(ev) {
    if (!ptrs.delete(ev.pointerId)) return;
    if (ptrs.size) return startGesture();
    gesture = null;
    if (ev.type === "pointerup" && !dragged) atlasSelect(atlasPick(ev.clientX, ev.clientY));
  }
  atMap.addEventListener("pointerup", endPointer);
  atMap.addEventListener("pointercancel", endPointer);
  // A plain wheel scrolls the page; pinch on a trackpad (or Ctrl + wheel) zooms the map.
  atMap.addEventListener("wheel", function (ev) {
    if (!ev.ctrlKey && !ev.metaKey) return;
    ev.preventDefault();
    var box = atStage.getBoundingClientRect();
    zoomAt(Math.exp(ev.deltaY * 0.01), ev.clientX - box.left, ev.clientY - box.top);
  }, { passive: false });
  atMap.addEventListener("dblclick", function (ev) {
    var box = atStage.getBoundingClientRect();
    zoomAt(1 / 1.7, ev.clientX - box.left, ev.clientY - box.top);
  });
  $("sm-at-in").addEventListener("click", function () { zoomAt(1 / 1.7, atStage.clientWidth / 2, atStage.clientHeight / 2); });
  $("sm-at-out").addEventListener("click", function () { zoomAt(1.7, atStage.clientWidth / 2, atStage.clientHeight / 2); });

  atCard.addEventListener("click", function (ev) {
    if (ev.target.closest("[data-close]")) return atlasSelect(null);
    var next = ev.target.closest("[data-next]");
    if (!next) return;
    var e = BY[next.dataset.next];
    atlasStop();
    setYear(Math.max(e.from, Math.min(e.to, e.from + 10)));
    atlasSelect(e, true);
  });
  $("sm-at-now").addEventListener("click", function (ev) {
    var b = ev.target.closest("[data-id]");
    if (b) atlasSelect(BY[b.dataset.id], true);
  });
  atRange.addEventListener("input", function () {
    atlasStop();
    setYear(Number(atRange.value));
  });

  // Play through time: about 150 years a second, and it stops at the last year.
  var playFrame = 0;
  function atlasStop() {
    if (!A.playing) return;
    A.playing = false;
    cancelAnimationFrame(playFrame);
    $("sm-at-play").innerHTML = PLAY_ICON;
    $("sm-at-play").setAttribute("aria-label", "Play through time");
  }
  $("sm-at-play").addEventListener("click", function () {
    if (A.playing) return atlasStop();
    A.playing = true;
    $("sm-at-play").innerHTML = PAUSE_ICON;
    $("sm-at-play").setAttribute("aria-label", "Pause");
    var y = A.year >= END ? START : A.year;
    var last = performance.now();
    var shownAt = 0;
    var tick = function (now) {
      if (!A.playing) return;
      y += ((now - last) / 1000) * 150;
      last = now;
      // Reduced motion: a new picture every 100 years, not a continuous sweep.
      if (!reduce || y - shownAt >= 100 || y >= END) {
        shownAt = y;
        setYear(y);
      }
      if (y >= END) return atlasStop();
      playFrame = requestAnimationFrame(tick);
    };
    playFrame = requestAnimationFrame(tick);
  });

  var araf = 0;
  new ResizeObserver(function () {
    if (araf || !A.ready) return;
    araf = requestAnimationFrame(function () {
      araf = 0;
      if (atStage.clientWidth) setCam(A.cam);
    });
  }).observe(atStage);

  // ---------- Views ----------

  var VIEWS = ["atlas", "timeline", "browse"];
  var current = "";
  function route() {
    var view = VIEWS.indexOf(location.hash.slice(1)) >= 0 ? location.hash.slice(1) : "atlas";
    if (view === current) return;
    if (current === "timeline") state.anchor = yearAtGuide();
    if (current === "atlas") atlasStop();
    current = view;
    VIEWS.forEach(function (v) {
      $("sm-v-" + v).hidden = v !== view;
    });
    VIEWS.forEach(function (v) {
      var tab = $("sm-tab-" + v);
      if (v === view) tab.setAttribute("aria-current", "page");
      else tab.removeAttribute("aria-current");
    });
    if (view === "timeline") {
      renderRegionChips();
      requestAnimationFrame(buildTimeline);
    } else if (view === "atlas") {
      // The atlas and the timeline share one year: switching tabs keeps your place in time.
      atlasInit();
      setYear(state.anchor);
      if (at && at.at && !A.linked) {
        A.linked = true;
        setYear(clamp(state.anchor, at.from, at.to));
        atlasSelect(at, true);
      }
    } else renderBrowse();
  }
  window.addEventListener("hashchange", route);
  document.documentElement.classList.add("sm-js");
  route();
})();
