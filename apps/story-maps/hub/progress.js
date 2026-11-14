// Remembers, on this device only, the last chapter read in each story (i) and
// the furthest reached (m), so the story page can offer "Continue from chapter
// 12" and the hub can show how far each story has been read. Inlined after the engine on story pages by
// scripts/build.mjs. The engine itself keeps nothing (test/engine.test.js).

(function () {
  "use strict";

  var KEY = "sm-progress";
  function read() {
    try {
      return JSON.parse(localStorage.getItem(KEY) || "{}") || {};
    } catch {
      return {};
    }
  }
  var id = JSON.parse(document.getElementById("sm-data").textContent).story.id;
  var saved = read()[id];
  if (saved && globalThis.StoryMap && globalThis.StoryMap.offerResume) globalThis.StoryMap.offerResume(saved.i);
  document.addEventListener("sm:chapter", function (ev) {
    try {
      var all = read();
      var before = all[ev.detail.story] || {};
      // i: the chapter to continue from; m: the furthest reached, for the ticks in Browse and the timeline.
      var furthest = Math.max(Number(before.m) || 0, Number(before.i) || 0, ev.detail.chapter);
      all[ev.detail.story] = { i: ev.detail.chapter, m: furthest, n: ev.detail.chapters, t: Date.now() };
      localStorage.setItem(KEY, JSON.stringify(all));
    } catch {
      /* storage blocked: the story still works */
    }
  });
})();
