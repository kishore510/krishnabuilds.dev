// Likes and reads, on story pages only. Inlined after the engine by
// scripts/build.mjs; the API is src/worker.js.
//
// - Every opening of the page counts as a read, repeat visits included.
// - The like button is on the end card only, so a like comes from someone who
//   reached the end. The top bar shows the count but can't be tapped.
// - There are no accounts, so this device remembers which stories it liked
//   (`sm-likes`) and offers to take a like back.
// If the API can't be reached (a local preview, an outage) nothing is shown.

(function () {
  "use strict";

  var KEY = "sm-likes";
  var id = JSON.parse(document.getElementById("sm-data").textContent).story.id;
  var bar = document.querySelector(".sm-bar-row");
  var endHead = document.querySelector("#sm-end-card .sm-realm-head");
  if (!bar || !endHead || !globalThis.fetch) return;

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

  var HEART =
    '<svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true"><path d="M8 14s-5.5-3.4-5.5-7.3A3 3 0 0 1 8 4.6a3 3 0 0 1 5.5 2.1C13.5 10.6 8 14 8 14z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>';
  var liked = Boolean(readLiked()[id]);
  var likes = 0;
  var reads = 0;
  var busy = false;
  var top;
  var button;
  var readLine;

  var plural = function (n, one, many) {
    return n + " " + (n === 1 ? one : many);
  };

  function paint() {
    // The stats are cached for a short while, so never show fewer likes than this reader's own.
    var shown = Math.max(likes, liked ? 1 : 0);
    top.hidden = !shown;
    top.classList.toggle("sm-like--mine", liked);
    top.setAttribute("aria-label", plural(shown, "like", "likes"));
    top.querySelector(".sm-like__n").textContent = String(shown);
    button.setAttribute("aria-pressed", String(liked));
    button.title = liked ? "Liked. Tap again to take it back." : "Like this story";
    button.querySelector(".sm-like__t").textContent = liked ? "Liked" : "Like this story";
    button.querySelector(".sm-like__n").textContent = shown ? String(shown) : "";
    readLine.textContent = reads ? "Opened " + plural(reads, "time", "times") : "";
  }

  function toggle() {
    if (busy) return;
    busy = true;
    var on = !liked;
    liked = on;
    likes = Math.max(0, likes + (on ? 1 : -1));
    paint();
    fetch("/api/like/" + id, { method: on ? "POST" : "DELETE" })
      .then(function (r) {
        if (!r.ok) throw new Error(String(r.status));
        return r.json();
      })
      .then(function (body) {
        likes = body.count;
        saveLiked(on);
      })
      .catch(function () {
        // Not counted (offline, or too many taps): put it back as it was.
        liked = !on;
        likes = Math.max(0, likes + (on ? -1 : 1));
      })
      .then(function () {
        busy = false;
        paint();
      });
  }

  var ok = function (r) {
    if (!r.ok) throw new Error(String(r.status));
    return r.json();
  };
  // Count this opening; its answer is the freshest read count there is.
  var read = fetch("/api/read/" + id, { method: "POST", keepalive: true }).then(ok).catch(function () {
    return null;
  });

  fetch("/api/stats")
    .then(ok)
    .then(function (stats) {
      likes = Number(stats.likes && stats.likes[id]) || 0;
      reads = Number(stats.reads && stats.reads[id]) || 0;

      top = document.createElement("span");
      top.className = "sm-like sm-like--count";
      top.setAttribute("role", "img");
      top.innerHTML = HEART + '<span class="sm-like__n"></span>';
      bar.insertBefore(top, document.getElementById("sm-when"));

      var box = document.createElement("div");
      box.className = "sm-end-like";
      button = document.createElement("button");
      button.type = "button";
      button.className = "sm-like sm-like--end";
      button.innerHTML = HEART + '<span class="sm-like__t"></span><span class="sm-like__n"></span>';
      button.addEventListener("click", toggle);
      readLine = document.createElement("span");
      readLine.className = "sm-reads";
      box.appendChild(button);
      box.appendChild(readLine);
      endHead.after(box);

      paint();
      return read;
    })
    .then(function (body) {
      if (body) {
        reads = Math.max(reads, body.count);
        paint();
      }
    })
    .catch(function () {
      /* no API here: leave the page as it is */
    });
})();
