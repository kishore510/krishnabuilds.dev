// Likes, on story pages only: a heart in the top bar and another on the end
// card, sharing one state. Inlined after the engine by scripts/build.mjs. The
// API is src/worker.js; there are no accounts, so this device remembers which
// stories it liked (`sm-likes`) and offers to take a like back. If the API
// can't be reached (a local preview, an outage) no button is shown.

(function () {
  "use strict";

  var KEY = "sm-likes";
  var id = JSON.parse(document.getElementById("sm-data").textContent).story.id;
  var bar = document.querySelector(".sm-bar-row");
  var endHead = document.querySelector("#sm-end-card .sm-realm-head");
  if (!bar || !globalThis.fetch) return;

  function readLiked() {
    try {
      return JSON.parse(localStorage.getItem(KEY) || "{}") || {};
    } catch {
      return {};
    }
  }
  function saveLiked(on) {
    try {
      var all = readLiked();
      if (on) all[id] = 1;
      else delete all[id];
      localStorage.setItem(KEY, JSON.stringify(all));
    } catch {
      /* storage blocked: the like still counts, it just isn't remembered */
    }
  }

  var liked = Boolean(readLiked()[id]);
  var count = 0;
  var busy = false;
  var buttons = [];

  function make(cls, withLabel) {
    var b = document.createElement("button");
    b.type = "button";
    b.className = cls;
    b.innerHTML =
      '<svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true"><path d="M8 14s-5.5-3.4-5.5-7.3A3 3 0 0 1 8 4.6a3 3 0 0 1 5.5 2.1C13.5 10.6 8 14 8 14z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>' +
      (withLabel ? '<span class="sm-like__t"></span>' : "") +
      '<span class="sm-like__n"></span>';
    b.addEventListener("click", toggle);
    buttons.push(b);
    return b;
  }

  function paint() {
    // The list is cached for a short while, so never show fewer likes than this reader's own.
    var shown = Math.max(count, liked ? 1 : 0);
    buttons.forEach(function (b) {
      b.setAttribute("aria-pressed", String(liked));
      b.setAttribute("aria-label", (liked ? "Liked" : "Like this story") + (shown ? ", " + shown + (shown === 1 ? " like" : " likes") : ""));
      b.title = liked ? "Liked. Tap again to take it back." : "Like this story";
      b.querySelector(".sm-like__n").textContent = shown ? String(shown) : "";
      var t = b.querySelector(".sm-like__t");
      if (t) t.textContent = liked ? "Liked" : "Like this story";
    });
  }

  function toggle() {
    if (busy) return;
    busy = true;
    var on = !liked;
    liked = on;
    count = Math.max(0, count + (on ? 1 : -1));
    paint();
    fetch("/api/like/" + id, { method: on ? "POST" : "DELETE" })
      .then(function (r) {
        if (!r.ok) throw new Error(String(r.status));
        return r.json();
      })
      .then(function (body) {
        count = body.count;
        saveLiked(on);
      })
      .catch(function () {
        // Not counted (offline, or too many taps): put it back as it was.
        liked = !on;
        count = Math.max(0, count + (on ? -1 : 1));
      })
      .then(function () {
        busy = false;
        paint();
      });
  }

  fetch("/api/likes")
    .then(function (r) {
      if (!r.ok) throw new Error(String(r.status));
      return r.json();
    })
    .then(function (all) {
      count = Number(all[id]) || 0;
      bar.insertBefore(make("sm-like", false), document.getElementById("sm-when"));
      if (endHead) {
        var box = document.createElement("div");
        box.className = "sm-end-like";
        box.appendChild(make("sm-like sm-like--end", true));
        endHead.after(box);
      }
      paint();
    })
    .catch(function () {
      /* no API here: leave the page as it is */
    });
})();
