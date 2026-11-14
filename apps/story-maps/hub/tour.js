// The guided tour: a few cards that point at each part of the page in turn.
// It opens by itself on a first visit to the hub and to a first story, and
// again whenever the reader taps the tour button it adds ("?" on a story's
// map, "How it works" on the hub). Inlined on the hub and on story pages by
// scripts/build.mjs, after the page's own script. It only reads the page: the
// engine knows nothing about it.

(function () {
  "use strict";

  var KEY = "sm-tour";
  var story = document.body.classList.contains("sm-story-page");
  var page = story ? "story" : "hub";
  var wide = window.matchMedia("(min-width: 900px)");
  /** @param {string} id */
  var $ = function (id) {
    return document.getElementById(id);
  };

  // --- what each card says ---------------------------------------------------

  /**
   * A step: `title`, `text`, and `targets`, the elements to light up (none for
   * a card in the middle of the page). A step whose targets are all missing or
   * hidden is left out. `clip` keeps the light off the part of the map that is
   * under the story sheet on a phone.
   */
  function storySteps() {
    var toggle = $("sm-realm-toggle");
    var layer = toggle && !toggle.hidden ? " “" + (toggle.textContent || "").trim() + "” shades who held which land." : "";
    return [
      {
        title: "A story told on a map",
        text: "This story is told in short chapters. As you read, the map moves to where each chapter happens. Here is a quick look around.",
      },
      {
        targets: [document.querySelector(".sm-controls")],
        title: "Move through the story",
        text: wide.matches
          ? "Next goes to the following chapter and Back to the one before. The round button plays the story by itself. The arrow keys work too."
          : "Next goes to the following chapter and Back to the one before. The round button plays the story by itself.",
      },
      {
        targets: wide.matches ? [$("sm-scroll")] : [$("sm-grip"), $("sm-scroll")],
        title: "Read the chapter",
        text: wide.matches
          ? "Each chapter is a short card. Under it you will find where the place is today and the people in the chapter."
          : "Each chapter is a short card. Drag the card up, or tap its handle, for more: where the place is today and the people in the chapter.",
      },
      {
        targets: [$("sm-stage")],
        clip: true,
        title: "Explore the map",
        text:
          (wide.matches ? "Drag to move and scroll to zoom." : "Drag to move and pinch to zoom.") +
          " Tap any place to see its chapters. “Whole map” shows the full story at once." +
          layer,
      },
      {
        targets: [$("sm-timeline"), $("sm-counter")],
        title: "Jump to any chapter",
        text: "Each dot on the line is a chapter. Tap or drag along it to jump. The chapters button under it lists every chapter by name.",
      },
      {
        targets: [button],
        title: "That is all",
        text: "Tap this button whenever you want the tour again.",
        done: "Start reading",
      },
    ];
  }

  function hubSteps() {
    var atlas = $("sm-v-atlas");
    var timeline = $("sm-v-timeline");
    var row = document.querySelector(".sm-story-row");
    return [
      {
        title: "Welcome to Story Maps",
        text: "Illustrated maps that tell a story chapter by chapter, on three shelves: Nature, Humankind and Science. Here is a quick look around.",
      },
      {
        targets: [document.querySelector(".sm-doors")],
        title: "Three shelves",
        text: "Nature is what happened, Humankind is what people did, and Science is how we found out. Each shelf holds subjects, and each subject its story maps.",
      },
      {
        targets: [row],
        title: "Start with a story",
        text: "Each card is a story told on a map. Swipe sideways to see them all and tap one to open it.",
      },
      {
        targets: [document.querySelector(".sm-explore-link")],
        title: "Explore through time",
        text: "The timeline and the atlas show who ruled when and where, and Browse lists and searches everything by name.",
      },
      {
        targets: [document.querySelector(".sm-tabs")],
        title: "Three ways to explore",
        text: "Timeline shows who ruled at the same time. Browse lists and searches everything by name. Atlas shows the world in a year you choose.",
      },
      {
        targets: [timeline && !timeline.hidden ? document.querySelector(".sm-tl") : null],
        title: "Move through time",
        text: "Scroll to move through the years; the line shows who ruled at the same moment. Pick regions above, and tap a block to read about it and open its story.",
      },
      {
        targets: [atlas && !atlas.hidden ? document.querySelector(".sm-at") : null],
        title: "Move through time",
        text: "Drag the year, or press play, and watch civilisations and empires come and go. Tap a circle to read about it and open its story.",
      },
      {
        targets: [button],
        title: "That is all",
        text: "Tap “How it works” whenever you want the tour again.",
        done: "Start exploring",
      },
    ];
  }

  // --- the button that starts it ---------------------------------------------

  var button = document.createElement("button");
  button.type = "button";
  button.className = "sm-tour-open";
  if (story) {
    button.textContent = "?";
    button.title = "How this works";
    button.setAttribute("aria-label", "How this works: take the tour");
    var stage = $("sm-stage");
    if (!stage) return;
    stage.appendChild(button);
  } else {
    button.textContent = "How it works";
    var hero = document.querySelector(".sm-hero");
    if (!hero) return;
    hero.appendChild(button);
  }
  button.addEventListener("click", function () {
    start();
  });

  // --- the tour itself ---------------------------------------------------------

  /** @type {HTMLElement | null} */
  var root = null;
  /** @type {HTMLElement} */ var light;
  /** @type {HTMLElement} */ var card;
  /** @type {HTMLElement} */ var count;
  /** @type {HTMLElement} */ var title;
  /** @type {HTMLElement} */ var text;
  /** @type {HTMLButtonElement} */ var back;
  /** @type {HTMLButtonElement} */ var next;
  /** @type {HTMLButtonElement} */ var skip;
  /** @type {any[]} */
  var steps = [];
  var at = 0;
  var queued = false;

  /** @param {string} tag @param {string} cls @param {string} [label] */
  function make(tag, cls, label) {
    var node = document.createElement(tag);
    node.className = cls;
    if (label) node.textContent = label;
    if (tag === "button") node.setAttribute("type", "button");
    return node;
  }

  function build() {
    root = make("div", "sm-tour");
    light = make("div", "sm-tour-light");
    card = make("div", "sm-tour-card");
    card.setAttribute("role", "dialog");
    card.setAttribute("aria-modal", "true");
    card.setAttribute("aria-labelledby", "sm-tour-title");
    card.setAttribute("aria-describedby", "sm-tour-text");
    count = make("p", "sm-tour-count");
    title = make("h2", "sm-tour-title");
    title.id = "sm-tour-title";
    text = make("p", "sm-tour-text");
    text.id = "sm-tour-text";
    var row = make("div", "sm-tour-row");
    skip = /** @type {HTMLButtonElement} */ (make("button", "sm-tour-skip", "Skip tour"));
    back = /** @type {HTMLButtonElement} */ (make("button", "sm-tour-back", "Back"));
    next = /** @type {HTMLButtonElement} */ (make("button", "sm-tour-next", "Next"));
    row.append(skip, back, next);
    card.append(count, title, text, row);
    root.append(light, card);
    skip.addEventListener("click", stop);
    back.addEventListener("click", function () {
      show(at - 1);
    });
    next.addEventListener("click", function () {
      if (at === steps.length - 1) stop();
      else show(at + 1);
    });
  }

  /** @param {Element | null} node */
  function visible(node) {
    if (!node) return false;
    var r = node.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  }

  /** The box around a step's targets, in viewport pixels; null for a centred card. */
  function boxOf(step) {
    var nodes = (step.targets || []).filter(visible);
    if (!nodes.length) return null;
    var l = Infinity;
    var t = Infinity;
    var r = -Infinity;
    var b = -Infinity;
    nodes.forEach(function (/** @type {Element} */ node) {
      var q = node.getBoundingClientRect();
      l = Math.min(l, q.left);
      t = Math.min(t, q.top);
      r = Math.max(r, q.right);
      b = Math.max(b, q.bottom);
    });
    var sheet = $("sm-sheet");
    if (step.clip && sheet && !wide.matches) b = Math.min(b, sheet.getBoundingClientRect().top);
    var pad = 5;
    var vw = document.documentElement.clientWidth;
    var vh = window.innerHeight;
    l = Math.max(l - pad, 4);
    t = Math.max(t - pad, 4);
    r = Math.min(r + pad, vw - 4);
    b = Math.min(b + pad, vh - 4);
    return { left: l, top: t, width: r - l, height: b - t, bottom: b };
  }

  function place() {
    queued = false;
    if (!root || !root.isConnected) return;
    var box = boxOf(steps[at]);
    var vw = document.documentElement.clientWidth;
    var vh = window.innerHeight;
    var gap = 12;
    root.classList.toggle("sm-tour--centre", !box);
    if (!box) {
      card.style.left = Math.max(gap, (vw - card.offsetWidth) / 2) + "px";
      card.style.top = Math.max(gap, (vh - card.offsetHeight) / 2) + "px";
      return;
    }
    light.style.left = box.left + "px";
    light.style.top = box.top + "px";
    light.style.width = box.width + "px";
    light.style.height = box.height + "px";
    var h = card.offsetHeight;
    var w = card.offsetWidth;
    var top;
    if (vh - box.bottom >= h + gap * 2) top = box.bottom + gap;
    else if (box.top >= h + gap * 2) top = box.top - h - gap;
    // No room above or below (the target fills the screen): sit inside it, at
    // the top, clear of the controls that are usually along its bottom edge.
    else top = Math.max(box.top, 0) + gap * 5;
    card.style.top = Math.max(gap, Math.min(top, vh - h - gap)) + "px";
    card.style.left = Math.max(gap, Math.min(box.left + box.width / 2 - w / 2, vw - w - gap)) + "px";
  }

  function queue() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(place);
  }

  /** @param {number} i */
  function show(i) {
    at = Math.max(0, Math.min(i, steps.length - 1));
    var step = steps[at];
    count.textContent = at + 1 + " of " + steps.length;
    title.textContent = step.title;
    text.textContent = step.text;
    back.hidden = at === 0;
    skip.hidden = at === steps.length - 1;
    next.textContent = at === steps.length - 1 ? step.done || "Done" : "Next";
    // The hub scrolls: bring the step into view before pointing at it.
    var first = (step.targets || []).filter(visible)[0];
    if (first && !story) {
      var r = first.getBoundingClientRect();
      if (r.top < 0 || r.bottom > window.innerHeight) {
        first.scrollIntoView({ block: r.height > window.innerHeight * 0.7 ? "start" : "center" });
      }
    }
    place();
    next.focus();
  }

  /** @param {KeyboardEvent} e */
  function onKey(e) {
    // Nothing behind the tour should react: the story's own arrow, space and
    // zoom keys would otherwise turn chapters under it.
    e.stopPropagation();
    if (e.key === "Escape") {
      e.preventDefault();
      stop();
    } else if (e.key === "ArrowRight" && at < steps.length - 1) show(at + 1);
    else if (e.key === "ArrowLeft" && at > 0) show(at - 1);
    else if (e.key === "Tab") {
      var stops = [skip, back, next].filter(function (b) {
        return !b.hidden;
      });
      var here = stops.indexOf(/** @type {HTMLButtonElement} */ (document.activeElement));
      e.preventDefault();
      stops[(here + (e.shiftKey ? stops.length - 1 : 1)) % stops.length].focus();
    }
  }

  function start() {
    if (root && root.isConnected) return;
    if (!root) build();
    steps = (story ? storySteps() : hubSteps()).filter(function (step) {
      return !step.targets || step.targets.some(visible);
    });
    seen();
    document.body.appendChild(/** @type {HTMLElement} */ (root));
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("resize", queue);
    window.addEventListener("scroll", queue, true);
    show(0);
  }

  function stop() {
    if (!root || !root.isConnected) return;
    root.remove();
    window.removeEventListener("keydown", onKey, true);
    window.removeEventListener("resize", queue);
    window.removeEventListener("scroll", queue, true);
    button.focus();
  }

  // --- first visit: open once, by itself ----------------------------------------

  /** @param {string} key */
  function read(key) {
    // Throws when storage is blocked; the caller then leaves the tour closed.
    return JSON.parse(localStorage.getItem(key) || "{}") || {};
  }

  function seen() {
    try {
      var all = read(KEY);
      all[page] = 1;
      localStorage.setItem(KEY, JSON.stringify(all));
    } catch {
      /* storage blocked: the tour still works from its button */
    }
  }

  try {
    // Someone who has already read chapters here knows the way around; they
    // still get the button.
    var isNew = !read(KEY)[page] && !(story && Object.keys(read("sm-progress")).length);
    if (isNew) setTimeout(start, 700);
  } catch {
    /* storage blocked: opening every visit would nag, so wait to be asked */
  }
})();
