// The hub page in the browser: the vertical timeline and Browse (filters,
// search, sort). Inlined after hub/explore.js by scripts/build.mjs; reads the
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
  var KIND = { civilisation: "Civilisation", dynasty: "Dynasty or empire", event: "Event", legend: "Epic or legend", route: "Route" };
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

  $("sm-count").innerHTML = "<b>" + explored.length + "</b> of " + E.length + " explored";

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
    var cls = "sm-blk" + (built(e) ? " sm-built" : "") + (ov ? " sm-ov" : "") + (explored.indexOf(e.id) >= 0 ? " sm-seen" : "");
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

  function card(e) {
    var r = REGION[e.region];
    var isNew = e.added && Date.now() - Date.parse(e.added) < 45 * 864e5;
    var tags = (built(e) ? '<span class="sm-pill sm-pill--map">Story map</span>' : "") +
      (isNew ? '<span class="sm-pill sm-pill--new">New</span>' : "") +
      (explored.indexOf(e.id) >= 0 ? '<span class="sm-pill">✓ Explored</span>' : "");
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
    list.sort(b.sort === "az" ? function (x, y) { return x.name.localeCompare(y.name); } : byDate);
    var plain = b.region === "all" && b.kind === "all" && !b.maps && !q;
    var recent = explored.slice(0, 8).map(function (id) { return BY[id]; });
    var fresh = E.filter(function (e) {
      return e.added && Date.now() - Date.parse(e.added) < 45 * 864e5;
    });
    var regionOpts = [["all", "All regions"]].concat(REGIONS.map(function (r) { return [r.id, r.title]; }));
    var kindOpts = [["all", "Everything"], ["civilisation", "Civilisations"], ["dynasty", "Dynasties & empires"], ["legend", "Epics & legends"], ["event", "Events"], ["route", "Routes"]];

    $("sm-browse-body").innerHTML =
      chipRow("Region", "data-br", regionOpts, b.region) +
      '<div class="sm-chips" role="group" aria-label="Kind">' + kindOpts.map(function (o) {
        return '<button type="button" class="sm-chip-btn" data-bk="' + o[0] + '" aria-pressed="' + (b.kind === o[0]) + '">' + o[1] + "</button>";
      }).join("") + '<button type="button" class="sm-chip-btn sm-chip-btn--maps" data-bm aria-pressed="' + b.maps + '">Story maps only</button></div>' +
      (plain && recent.length ? '<h2 class="sm-browse-h">Pick up where you left off</h2><ul class="sm-entry-row">' + recent.map(card).join("") + "</ul>" : "") +
      (plain && fresh.length ? '<h2 class="sm-browse-h">New</h2><ul class="sm-entry-row">' + fresh.map(card).join("") + "</ul>" : "") +
      '<div class="sm-browse-bar"><h2 class="sm-browse-h">' + (plain ? "Everything" : "Results") + ' <span class="sm-browse-n">' + list.length + "</span></h2>" +
      '<label class="sm-sort">Sort <select id="sm-sort"><option value="date"' + (b.sort === "date" ? " selected" : "") + '>Oldest first</option>' +
      '<option value="az"' + (b.sort === "az" ? " selected" : "") + ">A to Z</option></select></label></div>" +
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

  // ---------- Views ----------

  var current = "";
  function route() {
    var view = location.hash === "#browse" ? "browse" : "timeline";
    if (view === current) return;
    if (current === "timeline") state.anchor = yearAtGuide();
    current = view;
    $("sm-v-timeline").hidden = view !== "timeline";
    $("sm-v-browse").hidden = view !== "browse";
    ["timeline", "browse"].forEach(function (v) {
      var tab = $("sm-tab-" + v);
      if (v === view) tab.setAttribute("aria-current", "page");
      else tab.removeAttribute("aria-current");
    });
    if (view === "timeline") {
      renderRegionChips();
      requestAnimationFrame(buildTimeline);
    } else renderBrowse();
  }
  window.addEventListener("hashchange", route);
  document.documentElement.classList.add("sm-js");
  route();
})();
