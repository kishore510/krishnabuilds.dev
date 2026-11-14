// The front page in the browser: on each story card, pick up where the reader
// left off and show its likes (from src/worker.js, when it can be reached), and arrows on a row of cards too long to fit, for a mouse that
// cannot swipe. Everything on the page works without it.

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

    var buttons = row.parentNode.querySelectorAll(".sm-row__go");
    var raf = 0;
    function update() {
      raf = 0;
      var fits = row.scrollWidth <= row.clientWidth + 2;
      Array.prototype.forEach.call(buttons, function (b) {
        b.hidden = fits;
        b.disabled = b.dataset.go === "-1" ? row.scrollLeft < 2 : row.scrollLeft > row.scrollWidth - row.clientWidth - 2;
      });
    }
    function later() {
      if (!raf) raf = requestAnimationFrame(update);
    }
    Array.prototype.forEach.call(buttons, function (b) {
      b.addEventListener("click", function () {
        row.scrollBy({ left: Number(b.dataset.go) * row.clientWidth * 0.8, behavior: "smooth" });
      });
    });
    row.addEventListener("scroll", later, { passive: true });
    window.addEventListener("resize", later);
    update();
  });

  if (globalThis.fetch) {
    fetch("/api/likes")
      .then(function (r) {
        return r.ok ? r.json() : {};
      })
      .then(function (counts) {
        Array.prototype.forEach.call(document.querySelectorAll(".sm-story-card"), function (a) {
          var n = Number(counts[a.dataset.story]) || 0;
          var el = a.querySelector("[data-likes]");
          if (!el || !n) return;
          el.textContent = "♥ " + n;
          el.setAttribute("aria-label", n + (n === 1 ? " like" : " likes"));
          el.hidden = false;
        });
      })
      .catch(function () {
        /* no API here: the cards stay as they are */
      });
  }
})();
