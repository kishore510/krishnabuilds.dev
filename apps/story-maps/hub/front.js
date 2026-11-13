// The front page in the browser: on each story card, pick up where the reader
// left off. Everything on the page works without it.

(function () {
  "use strict";

  var progress = {};
  try {
    progress = JSON.parse(localStorage.getItem("sm-progress") || "{}") || {};
  } catch {
    /* storage blocked */
  }
  Array.prototype.forEach.call(document.querySelectorAll(".sm-story-row"), function (row) {
    var started = [];
    Array.prototype.forEach.call(row.children, function (li) {
      var a = li.firstElementChild;
      var p = progress[a.dataset.story];
      if (!p || !(p.i > 0) || !(p.n > 1)) return;
      var done = p.i >= p.n - 1;
      a.querySelector("[data-meta]").textContent = done ? "Read · " + p.n + " chapters" : "Continue · chapter " + (p.i + 1) + " of " + p.n;
      a.style.setProperty("--read", Math.round(((p.i + 1) / p.n) * 100) + "%");
      a.classList.add("sm-started");
      if (!done) {
        a.href = a.getAttribute("href") + "#" + (p.i + 1);
        started.push({ li: li, t: p.t || 0 });
      }
    });
    started.sort(function (x, y) { return x.t - y.t; }).forEach(function (x) { row.prepend(x.li); });
  });
})();
