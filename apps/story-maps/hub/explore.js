// Pure functions over the catalogue (catalogue.json), shared by the build
// (entry pages, run in Node by scripts/catalogue.mjs) and the hub page (the
// timeline and Browse, inlined as a classic script). No DOM here.

(function (root) {
  "use strict";

  /** "322 BCE" or "1526 CE". There is no year 0. */
  function yearText(y) {
    return y < 0 ? -y + " BCE" : y + " CE";
  }

  function isDated(e) {
    return typeof e.from === "number";
  }

  /** Civilisations and dynasties (or empires) span years and fill the timeline's lanes. */
  function isSpan(e) {
    return e.kind === "dynasty" || e.kind === "civilisation";
  }

  /** Events and discoveries happen in one year. */
  function isMoment(e) {
    return e.kind === "event" || e.kind === "discovery";
  }

  /** The last year an entry covers: events and discoveries cover one year. */
  function endOf(e) {
    return isMoment(e) ? e.from : e.to;
  }

  /** "c. 322 – c. 185 BCE", "c. 100 BCE – c. 220 CE", "1526 CE", "Tradition" for undated legends, or deep time's own words. */
  function rangeText(e) {
    if (!isDated(e)) return e.kind === "legend" ? "Tradition" : e.when || "";
    var c = e.approx ? "c. " : "";
    if (isMoment(e)) return c + yearText(e.from);
    if (e.from < 0 && e.to < 0) return c + -e.from + " – " + c + -e.to + " BCE";
    if (e.from > 0) return c + e.from + " – " + c + e.to + " CE";
    return c + -e.from + " BCE – " + c + e.to + " CE";
  }

  /** Length in years, rounded to tens for long spans ("about 140 years"). */
  function lengthText(e) {
    if (!isDated(e) || isMoment(e)) return "";
    // No year 0, so 1 BCE to 1 CE is one year.
    var n = e.to - e.from - (e.from < 0 && e.to > 0 ? 1 : 0);
    if (n >= 100) n = Math.round(n / 10) * 10;
    return (e.approx ? "about " : "") + n + (n === 1 ? " year" : " years");
  }

  /** Civilisations and dynasties in the same lane, oldest first. */
  function laneMates(e, entries) {
    return entries
      .filter(function (x) {
        return isSpan(x) && x.lane && x.lane === e.lane && x.id !== e.id;
      })
      .sort(function (a, b) {
        return a.from - b.from;
      });
  }

  /**
   * What came before and after in the same region: named successors (`after`)
   * first, otherwise the nearest dynasty in the same lane.
   */
  function neighbours(e, entries) {
    var byId = {};
    entries.forEach(function (x) {
      byId[x.id] = x;
    });
    var before = entries.find(function (x) {
      return x.after && x.after.indexOf(e.id) >= 0;
    });
    var after = e.after && byId[e.after[0]];
    if (e.lane && isDated(e)) {
      var mates = laneMates(e, entries);
      var end = endOf(e);
      if (!before) {
        before = mates
          .filter(function (x) {
            return x.from < e.from && x.to <= e.from + 30;
          })
          .sort(function (a, b) {
            return b.to - a.to;
          })[0];
      }
      if (!after) {
        after = mates.filter(function (x) {
          return x.from > e.from && x.from >= end - 30;
        })[0];
      }
    }
    return { before: before || null, after: after || null };
  }

  /** Civilisations and dynasties in other lanes that overlap this entry, longest overlap first. */
  function meanwhile(e, entries, limit) {
    if (!isDated(e) || e.kind === "route") return [];
    var end = endOf(e);
    return entries
      .filter(function (x) {
        return isSpan(x) && x.id !== e.id && x.lane !== e.lane && x.from <= end && x.to >= e.from;
      })
      .map(function (x) {
        var from = Math.max(x.from, e.from);
        var to = Math.min(x.to, end);
        return { entry: x, from: from, to: to, years: Math.max(1, to - from) };
      })
      .sort(function (a, b) {
        return b.years - a.years || a.entry.from - b.entry.from;
      })
      .slice(0, limit || 8);
  }

  /** People whose lives overlap this entry's years, longest overlap first: who was at work while this went on. */
  function lives(e, entries, limit) {
    if (!isDated(e)) return [];
    var end = endOf(e);
    return entries
      .filter(function (x) {
        return x.kind === "person" && x.id !== e.id && x.from <= end && x.to >= e.from;
      })
      .sort(function (a, b) {
        return Math.min(b.to, end) - Math.max(b.from, e.from) - (Math.min(a.to, end) - Math.max(a.from, e.from)) || a.from - b.from;
      })
      .slice(0, limit || 6);
  }

  /** Other entries from the same region, nearest in time first, skipping the given ids. */
  function moreFromRegion(e, entries, skip, limit) {
    var mid = isDated(e) ? (e.from + endOf(e)) / 2 : 0;
    var dist = function (x) {
      return isDated(x) ? Math.abs((x.from + endOf(x)) / 2 - mid) : 1e9;
    };
    return entries
      .filter(function (x) {
        return x.region === e.region && x.id !== e.id && skip.indexOf(x.id) < 0;
      })
      .sort(function (a, b) {
        return dist(a) - dist(b);
      })
      .slice(0, limit || 6);
  }

  /** First and last years the timeline shows: whole centuries around every entry on it. */
  function bounds(entries) {
    var lo = Infinity;
    var hi = -Infinity;
    entries.forEach(function (e) {
      if (!e.lane || !isDated(e)) return;
      lo = Math.min(lo, e.from);
      hi = Math.max(hi, endOf(e));
    });
    if (lo === Infinity) return { start: -500, end: 2000 };
    return { start: Math.floor(lo / 100) * 100, end: Math.ceil(hi / 100) * 100 };
  }

  /**
   * Lays out one lane's dynasties on a vertical timeline.
   * opts: s (pixels per year), start (first year), pad (pixels above start),
   * minH (shortest block), tol (years of overlap still treated as a handover).
   * Overlapping entries go side by side in slots, one overlap cluster at a time.
   * A short block that is stretched to minH nudges the next one in its slot down
   * rather than forcing a new slot.
   * Returns the blocks ({ entry, top, h, k: slot, n: slots in its cluster }) and
   * the most slots any cluster needs.
   */
  function pack(dynasties, opts) {
    var items = dynasties
      .map(function (e) {
        var top = (e.from - opts.start) * opts.s + opts.pad;
        return { entry: e, top: top, h: Math.max((e.to - e.from) * opts.s, opts.minH), k: 0, n: 1 };
      })
      .sort(function (a, b) {
        return a.top - b.top || b.h - a.h;
      });
    var cluster = [];
    var last = [];
    var maxBottom = -1;
    var most = 1;
    function flush() {
      cluster.forEach(function (it) {
        it.n = last.length;
      });
      most = Math.max(most, last.length);
      cluster = [];
      last = [];
      maxBottom = -1;
    }
    items.forEach(function (it) {
      if (cluster.length && it.top >= maxBottom) flush();
      var k = last.findIndex(function (p) {
        return p.entry.to <= it.entry.from + opts.tol;
      });
      if (k < 0) {
        k = last.length;
        last.push(null);
      }
      var prev = last[k];
      if (prev && prev.top + prev.h + 3 > it.top) {
        var bottom = it.top + it.h;
        it.top = prev.top + prev.h + 3;
        it.h = Math.max(bottom - it.top, opts.minH);
      }
      last[k] = it;
      it.k = k;
      cluster.push(it);
      maxBottom = Math.max(maxBottom, it.top + it.h + 2);
    });
    flush();
    return { items: items, slots: most };
  }

  root.Explore = {
    yearText: yearText,
    rangeText: rangeText,
    lengthText: lengthText,
    isDated: isDated,
    isSpan: isSpan,
    endOf: endOf,
    laneMates: laneMates,
    neighbours: neighbours,
    meanwhile: meanwhile,
    lives: lives,
    moreFromRegion: moreFromRegion,
    bounds: bounds,
    pack: pack,
  };
})(globalThis);
