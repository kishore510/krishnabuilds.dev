// Story Maps engine, part 2: the player. Builds the map from the page's
// #sm-data JSON and runs it: steps, Play/Back/Next, the timeline, the camera,
// the story sheet, the realms layer and the people cards. Nothing here is specific to one story.
//
// Performance rules (apps/story-maps/CLAUDE.md): the camera is never
// re-centred while the sheet is being dragged; resize work is coalesced into
// one requestAnimationFrame; animations stop on their own and respect
// prefers-reduced-motion.

(function (SM) {
  "use strict";

  const data = JSON.parse(document.getElementById("sm-data").textContent);
  const { story, basemap, art } = data;
  const steps = story.steps;
  const LAST = steps.length - 1;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const wide = window.matchMedia("(min-width: 900px)");
  const $ = (id) => document.getElementById(id);
  const r1 = (n) => Math.round(n * 10) / 10;
  const lerp = (a, b, t) => a + (b - a) * t;
  const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

  // --- build the map --------------------------------------------------------------

  const svg = $("sm-map");
  const built = SM.buildMap(story, basemap, art);
  const [MAP_W, MAP_H] = built.size;
  svg.innerHTML = built.svg;

  const legs = built.legs.map((leg) => {
    const g = svg.querySelector(`[data-leg="${leg.index}"]`);
    const under = g.querySelector(".sm-leg-under");
    const over = g.querySelector(".sm-leg-over");
    return { ...leg, g, under, over, length: under.getTotalLength(), pattern: leg.dash.split(/[ ,]+/).map(Number), shown: -1 };
  });
  const legsOf = steps.map((_, i) => legs.filter((l) => l.step === i));

  /** A dash array that draws the first `progress` of the leg in its own dash pattern. */
  function revealDash(leg, progress) {
    const target = leg.length * progress;
    const gap = leg.length + 60;
    const parts = [];
    let drawn = 0;
    for (let i = 0; i < 4000; i++) {
      const seg = leg.pattern[i % leg.pattern.length];
      const isDash = i % 2 === 0;
      if (drawn + seg >= target) {
        if (isDash) parts.push(Math.max(0.05, target - drawn));
        parts.push(gap);
        break;
      }
      parts.push(seg);
      drawn += seg;
    }
    return parts.join(" ");
  }

  function showLeg(leg, progress) {
    if (progress === leg.shown) return;
    leg.shown = progress;
    if (progress <= 0) {
      leg.g.style.visibility = "hidden";
      return;
    }
    leg.g.style.visibility = "";
    const dash = progress >= 1 ? leg.dash : revealDash(leg, progress);
    leg.under.style.strokeDasharray = dash;
    leg.over.style.strokeDasharray = dash;
  }

  const marker = svg.querySelector(".sm-marker");
  const icons = {};
  for (const g of marker.querySelectorAll("[data-traveller]")) icons[g.dataset.traveller] = g;
  const firstTraveller = Object.keys(story.travellers)[0];
  function showTraveller(id) {
    for (const [name, g] of Object.entries(icons)) g.style.display = name === id ? "" : "none";
  }
  function moveMarker(x, y) {
    marker.setAttribute("transform", `translate(${r1(x)} ${r1(y)})`);
  }
  function markerOnLeg(leg, progress) {
    const p = leg.under.getPointAtLength(leg.length * progress);
    moveMarker(p.x, p.y);
  }

  const pins = [...svg.querySelectorAll(".sm-pin")];
  const effects = [...svg.querySelectorAll(".sm-effect")];

  // --- camera -------------------------------------------------------------------------

  const stage = $("sm-stage");
  const sheet = $("sm-sheet");
  const main = $("sm-main");
  const covered = () => (wide.matches ? 0 : sheet.offsetHeight);
  let cam = { ...built.overview };
  // True once the reader zooms or pans: the story then leaves the camera alone
  // until the next step (or Whole map) takes it back.
  let readerCamera = false;

  /** Widen a camera so its whole area fits above the sheet, and never zoom in too far. */
  function fit(c) {
    const cw = stage.clientWidth || 390;
    const visible = Math.max(140, (stage.clientHeight || 600) - covered());
    const span = (c.w * MAP_H) / MAP_W;
    return { x: c.x, y: c.y, w: Math.max(c.w, (span * cw) / visible, cw / 2.2) };
  }
  function applyCamera(c) {
    const cw = stage.clientWidth || 390;
    const ch = stage.clientHeight || 600;
    const unitsPerPx = c.w / cw;
    const h = ch * unitsPerPx;
    const shift = (covered() / 2) * unitsPerPx;
    svg.setAttribute("viewBox", `${r1(c.x - c.w / 2)} ${r1(c.y - h / 2 + shift)} ${r1(c.w)} ${r1(h)}`);
  }
  const stepCamera = (i) => fit(SM.cameraFor(steps[i], basemap));
  const overviewCamera = () => fit(built.overview);

  let camFrame = 0;
  function moveCamera(target, duration) {
    cancelAnimationFrame(camFrame);
    if (reduce || !duration) {
      cam = target;
      applyCamera(cam);
      return;
    }
    const from = { ...cam };
    const start = performance.now();
    const tick = (now) => {
      const e = ease(Math.min(1, (now - start) / duration));
      cam = { x: lerp(from.x, target.x, e), y: lerp(from.y, target.y, e), w: lerp(from.w, target.w, e) };
      applyCamera(cam);
      if (e < 1) camFrame = requestAnimationFrame(tick);
    };
    camFrame = requestAnimationFrame(tick);
  }

  // --- story card, chapters and timeline ---------------------------------------------------

  const el = {
    title: $("sm-title"), native: $("sm-native"), text: $("sm-text"), today: $("sm-today"), phase: $("sm-phase"),
    phaseDot: $("sm-phase-dot"), source: $("sm-source"), counter: $("sm-counter"), when: $("sm-when"),
    play: $("sm-play"), prev: $("sm-prev"), next: $("sm-next"), overview: $("sm-overview"), chapters: $("sm-chapters"),
    scroll: $("sm-scroll"), grip: $("sm-grip"), timeline: $("sm-timeline"), track: $("sm-track"),
  };

  el.track.style.background = `linear-gradient(90deg,${story.timeline.track
    .map((seg, i, all) => `${seg.color} ${i ? all[i - 1].until : 0}% ${seg.until}%`)
    .join(",")})`;

  const chapterButtons = [];
  const dots = [];
  steps.forEach((step, i) => {
    const color = story.phases[step.phase].color;
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = String(i + 1);
    b.title = step.title;
    b.setAttribute("aria-label", `Step ${i + 1}: ${step.title}`);
    b.style.setProperty("--phase", color);
    b.addEventListener("click", () => {
      stopPlaying();
      goTo(i);
    });
    el.chapters.appendChild(b);
    chapterButtons.push(b);
    const dot = document.createElement("i");
    dot.className = "sm-dot";
    dot.style.left = `${step.at}%`;
    dot.style.setProperty("--phase", color);
    el.timeline.appendChild(dot);
    dots.push(dot);
  });
  for (const tick of story.timeline.ticks) {
    const t = document.createElement("span");
    t.className = tick.at >= 100 ? "sm-tick end" : "sm-tick";
    t.style.left = `${tick.at}%`;
    t.textContent = tick.text;
    el.timeline.appendChild(t);
  }

  let current = -1;
  let headAt = steps[0].at;
  function setHead(x) {
    headAt = x;
    el.timeline.style.setProperty("--x", `${r1(x)}%`);
  }

  function renderCard(i) {
    const step = steps[i];
    const phase = story.phases[step.phase];
    el.title.textContent = step.title;
    el.native.textContent = step.native || "";
    el.text.textContent = step.text;
    el.today.textContent = step.today || "";
    el.phase.textContent = phase.name;
    el.phaseDot.style.background = phase.color;
    el.source.textContent = step.source || story.source;
    el.counter.textContent = `${i + 1} of ${steps.length}`;
    el.when.textContent = step.when;
    el.prev.disabled = i === 0;
    el.next.disabled = i === LAST;
    chapterButtons.forEach((b, j) => {
      if (j === i) b.setAttribute("aria-current", "step");
      else b.removeAttribute("aria-current");
      b.classList.toggle("seen", j < i);
    });
    dots.forEach((d, j) => d.classList.toggle("on", j <= i));
    el.scroll.scrollTop = 0;
    renderRealms(i);
    renderPeople(i);
  }

  function renderPins(i) {
    const visited = new Set(steps.slice(0, i + 1).map((s) => s.place));
    for (const pin of pins) {
      pin.classList.toggle("future", !visited.has(pin.dataset.place));
      pin.classList.toggle("active", pin.dataset.place === steps[i].place);
    }
    for (const e of effects) {
      const effect = story.effects[Number(e.dataset.effect)];
      e.classList.toggle("on", effect.steps.includes(i));
    }
  }

  // --- moving between steps -------------------------------------------------------------

  let anim = null;
  let playing = false;
  let holdTimer = 0;

  function setPlayLabel() {
    el.play.textContent = playing ? "Pause" : current === LAST && !anim ? "Replay" : "Play";
  }
  function stopPlaying() {
    playing = false;
    clearTimeout(holdTimer);
    setPlayLabel();
  }

  function goTo(target, options) {
    const instant = (options && options.instant) || reduce;
    const i = Math.max(0, Math.min(LAST, target));
    if (anim) cancelAnimationFrame(anim.frame);
    anim = null;
    clearTimeout(holdTimer);
    cancelAnimationFrame(camFrame);
    closeRealm();
    closePerson();
    readerCamera = false;
    const headFrom = headAt;
    current = i;
    renderCard(i);
    renderPins(i);
    for (const leg of legs) showLeg(leg, leg.step < i ? 1 : 0);

    const target_ = stepCamera(i);
    const mine = legsOf[i];
    const headTo = steps[i].at;
    const settle = () => {
      if (!readerCamera) cam = target_;
      applyCamera(cam);
      setHead(headTo);
      setPlayLabel();
      afterStep();
    };

    if (!mine.length) {
      showTraveller(firstTraveller);
      const [x, y] = built.places[steps[i].place];
      moveMarker(x, y);
      if (instant) return settle();
    } else {
      showTraveller(mine[0].traveller);
      markerOnLeg(mine[0], 0);
      if (instant) {
        for (const leg of mine) showLeg(leg, 1);
        const last = mine[mine.length - 1];
        showTraveller(last.traveller);
        markerOnLeg(last, 1);
        return settle();
      }
    }

    const camFrom = { ...cam };
    const start = performance.now();
    const lead = mine.length ? 650 : 0;
    const durations = mine.map((l) => Math.min(3300, Math.max(1000, l.length * 10)));
    const travel = durations.reduce((a, b) => a + b, 0);
    const camDuration = 1500;
    const span = Math.max(camDuration, lead + travel);
    anim = { frame: 0 };
    setPlayLabel();

    const frame = (now) => {
      const t = now - start;
      const ce = ease(Math.min(1, t / camDuration));
      if (!readerCamera) {
        cam = { x: lerp(camFrom.x, target_.x, ce), y: lerp(camFrom.y, target_.y, ce), w: lerp(camFrom.w, target_.w, ce) };
        applyCamera(cam);
      }
      setHead(lerp(headFrom, headTo, ease(Math.min(1, t / span))));
      const tt = t - lead;
      let before = 0;
      let active = -1;
      mine.forEach((leg, m) => {
        const d = durations[m];
        showLeg(leg, tt >= before + d ? 1 : tt > before ? ease((tt - before) / d) : 0);
        if (active < 0 && tt < before + d) active = m;
        before += d;
      });
      if (mine.length) {
        const m = active < 0 ? mine.length - 1 : active;
        const begin = durations.slice(0, m).reduce((a, b) => a + b, 0);
        const p = active < 0 ? 1 : Math.max(0, Math.min(1, (tt - begin) / durations[m]));
        showTraveller(mine[m].traveller);
        markerOnLeg(mine[m], ease(p));
      }
      if (t < span + 200) anim.frame = requestAnimationFrame(frame);
      else {
        anim = null;
        settle();
      }
    };
    anim.frame = requestAnimationFrame(frame);
  }

  function afterStep() {
    if (!playing) return;
    if (current >= LAST) {
      playing = false;
      setPlayLabel();
      return;
    }
    const hold = reduce ? 3500 : 1800 + steps[current].text.length * 9;
    holdTimer = setTimeout(() => goTo(current + 1), hold);
  }
  function startPlaying() {
    if (current >= LAST && !anim) {
      playing = true;
      goTo(0);
      return;
    }
    playing = true;
    setPlayLabel();
    if (!anim) {
      clearTimeout(holdTimer);
      holdTimer = setTimeout(() => goTo(current + 1), 300);
    }
  }

  el.play.addEventListener("click", () => (playing ? stopPlaying() : startPlaying()));
  el.next.addEventListener("click", () => {
    stopPlaying();
    goTo(current + 1);
  });
  el.prev.addEventListener("click", () => {
    stopPlaying();
    goTo(current - 1);
  });
  el.overview.addEventListener("click", () => {
    stopPlaying();
    if (anim) goTo(current, { instant: true });
    readerCamera = true;
    moveCamera(overviewCamera(), 1000);
  });
  document.addEventListener("keydown", (e) => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    const onControl = e.target instanceof Element && e.target.closest("button, a, input, textarea, select");
    if (e.key === "ArrowRight") {
      stopPlaying();
      goTo(current + 1);
    } else if (e.key === "ArrowLeft") {
      stopPlaying();
      goTo(current - 1);
    } else if (e.key === " " && !onControl) {
      e.preventDefault();
      if (playing) stopPlaying();
      else startPlaying();
    }
  });

  // Timeline: tap to jump, drag to scrub.
  function nearestStep(clientX) {
    const box = el.timeline.getBoundingClientRect();
    const x = ((clientX - box.left) / box.width) * 100;
    let best = 0;
    steps.forEach((s, i) => {
      if (Math.abs(s.at - x) < Math.abs(steps[best].at - x)) best = i;
    });
    return best;
  }
  let scrubbing = false;
  let scrubbed = false;
  el.timeline.addEventListener("pointerdown", (e) => {
    scrubbing = true;
    scrubbed = false;
    el.timeline.setPointerCapture?.(e.pointerId);
    stopPlaying();
  });
  el.timeline.addEventListener("pointermove", (e) => {
    if (!scrubbing) return;
    const i = nearestStep(e.clientX);
    if (i !== current) {
      scrubbed = true;
      goTo(i, { instant: true });
    }
  });
  el.timeline.addEventListener("pointerup", (e) => {
    if (!scrubbing) return;
    scrubbing = false;
    if (!scrubbed) goTo(nearestStep(e.clientX));
  });
  el.timeline.addEventListener("pointercancel", () => {
    scrubbing = false;
  });

  // --- the story sheet (phones): tap or drag the grip -------------------------------------

  let drag = null;
  let sheetDone = null;

  function recentre(smooth) {
    if (current < 0 || anim || (drag && drag.moved)) return; // never while dragging
    if (readerCamera) {
      applyCamera(cam);
      return;
    }
    moveCamera(stepCamera(current), smooth ? 320 : 0);
  }
  function finishSheet() {
    if (sheetDone) {
      const done = sheetDone;
      sheetDone = null;
      done();
    }
  }
  /** Height of the closed sheet, measured without disturbing the open one. */
  function closedHeight() {
    const wasOpen = sheet.classList.contains("open");
    const { height, maxHeight } = sheet.style;
    sheet.classList.remove("open");
    sheet.style.height = "";
    sheet.style.maxHeight = "";
    const h = sheet.offsetHeight;
    if (wasOpen) sheet.classList.add("open");
    sheet.style.height = height;
    sheet.style.maxHeight = maxHeight;
    return h;
  }
  const tallest = () => Math.round(main.clientHeight * 0.82);
  function openHeight() {
    const wasOpen = sheet.classList.contains("open");
    const { height, maxHeight } = sheet.style;
    sheet.classList.add("open");
    sheet.style.height = "";
    sheet.style.maxHeight = "none";
    const natural = sheet.offsetHeight;
    sheet.classList.toggle("open", wasOpen);
    sheet.style.height = height;
    sheet.style.maxHeight = maxHeight;
    return Math.min(natural, Math.round(main.clientHeight * 0.6));
  }
  function syncGrip() {
    const open = sheet.classList.contains("open");
    el.grip.setAttribute("aria-expanded", String(open));
    el.grip.setAttribute(
      "aria-label",
      open ? "Drag to resize the story panel, or press to collapse" : "Drag to resize the story panel, or press to show the full story",
    );
  }
  function setSheetHeight(h, min) {
    const clamped = Math.max(min, Math.min(tallest(), h));
    if (clamped <= min + 14) {
      sheet.classList.remove("open");
      sheet.style.height = "";
      sheet.style.maxHeight = "";
    } else {
      sheet.classList.add("open");
      sheet.style.maxHeight = "none";
      sheet.style.height = `${Math.round(clamped)}px`;
    }
    syncGrip();
  }
  function animateSheet(target) {
    finishSheet();
    const min = closedHeight();
    const from = sheet.offsetHeight;
    const to = target <= min + 14 ? min : Math.min(tallest(), Math.max(min + 30, target));
    if (reduce || from === to) {
      setSheetHeight(to, min);
      recentre(true);
      return;
    }
    sheet.classList.add("open", "moving");
    sheet.style.maxHeight = "none";
    sheet.style.height = `${from}px`;
    void sheet.offsetHeight;
    sheet.style.transition = "height .38s cubic-bezier(.22,.8,.24,1)";
    sheet.style.height = `${to}px`;
    let finished = false;
    const end = () => {
      if (finished) return;
      finished = true;
      clearTimeout(fallback);
      sheet.removeEventListener("transitionend", onEnd);
      sheet.style.transition = "";
      sheet.classList.remove("moving");
      setSheetHeight(to, min);
      sheetDone = null;
      recentre(true);
    };
    const onEnd = (e) => {
      if (e.target === sheet && e.propertyName === "height") end();
    };
    sheet.addEventListener("transitionend", onEnd);
    const fallback = setTimeout(end, 520);
    sheetDone = end;
  }
  function toggleSheet() {
    const min = closedHeight();
    if (sheet.classList.contains("open") && sheet.offsetHeight > min + 14) animateSheet(min);
    else animateSheet(openHeight());
  }
  el.scroll.addEventListener("click", () => {
    if (!wide.matches && !sheet.classList.contains("open")) animateSheet(openHeight());
  });
  el.grip.addEventListener("pointerdown", (e) => {
    finishSheet();
    drag = { y: e.clientY, h: sheet.offsetHeight, min: closedHeight(), moved: false };
    el.grip.setPointerCapture?.(e.pointerId);
  });
  el.grip.addEventListener("pointermove", (e) => {
    if (!drag) return;
    const dy = drag.y - e.clientY;
    if (!drag.moved && Math.abs(dy) > 5) drag.moved = true;
    if (drag.moved) setSheetHeight(drag.h + dy, drag.min);
  });
  el.grip.addEventListener("pointerup", () => {
    if (!drag) return;
    const d = drag;
    drag = null;
    if (d.moved) recentre(true);
    else toggleSheet();
  });
  el.grip.addEventListener("pointercancel", () => {
    drag = null;
    recentre(true);
  });
  el.grip.addEventListener("click", (e) => {
    if (e.detail === 0) toggleSheet(); // keyboard activation
  });
  let keyTimer = 0;
  el.grip.addEventListener("keydown", (e) => {
    if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
    e.preventDefault();
    setSheetHeight(sheet.offsetHeight + (e.key === "ArrowUp" ? 48 : -48), closedHeight());
    clearTimeout(keyTimer);
    keyTimer = setTimeout(() => recentre(true), 220);
  });

  // --- realms (kingdoms) ------------------------------------------------------------------------

  const realms = story.realms;
  const realmLayer = svg.querySelector(".sm-realms");
  const realmToggle = $("sm-realm-toggle");
  const realmBox = $("sm-realm-box");
  const mainChips = $("sm-main-chips");
  const minorChips = $("sm-minor-chips");
  const byId = {};
  let realmsOn = false;
  let openRealmId = null;

  const activeAt = (realm, i) => realm.active.some(([a, b]) => i >= a && i <= b);
  const latest = (list, i) => list.filter((x) => x.from <= i).pop();

  function renderRealms(i) {
    if (!realms) return;
    realmLayer.classList.toggle("on", realmsOn);
    for (const g of realmLayer.querySelectorAll(".sm-realm")) g.classList.toggle("active", activeAt(byId[g.dataset.id], i));
    mainChips.replaceChildren();
    minorChips.replaceChildren();
    if (realmsOn) {
      for (const realm of realms.items) {
        if (!activeAt(realm, i)) continue;
        const chip = document.createElement("button");
        chip.type = "button";
        chip.className = "sm-chip-button";
        const swatch = document.createElement("i");
        swatch.style.background = realm.color;
        chip.append(swatch, realm.name);
        chip.addEventListener("click", () => openRealm(realm.id));
        (realm.minor ? minorChips : mainChips).appendChild(chip);
      }
    }
    const hasMain = mainChips.children.length > 0;
    const hasMinor = minorChips.children.length > 0;
    $("sm-main-heading").hidden = !hasMain;
    mainChips.hidden = !hasMain;
    $("sm-minor-heading").hidden = !hasMinor;
    minorChips.hidden = !hasMinor;
    realmBox.hidden = !(realmsOn && (hasMain || hasMinor));
  }

  function openRealm(id) {
    const realm = byId[id];
    if (!realm || !realmsOn || !activeAt(realm, current)) return;
    stopPlaying();
    closePerson();
    openRealmId = id;
    const ruler = latest(realm.rulers, current);
    $("sm-realm-swatch").style.background = realm.color;
    $("sm-realm-name").textContent = realm.name;
    $("sm-realm-native").textContent = realm.native || "";
    $("sm-realm-ruler").textContent = `Ruler at this point: ${ruler ? ruler.text : "not named"}`;
    const facts = $("sm-realm-facts");
    facts.replaceChildren();
    for (const [label, value] of Object.entries(realm.facts)) {
      const dt = document.createElement("dt");
      const dd = document.createElement("dd");
      dt.textContent = label;
      dd.textContent = value;
      facts.append(dt, dd);
    }
    $("sm-realm-role").textContent = realm.role;
    const ties = $("sm-realm-ties");
    ties.replaceChildren();
    for (const tie of realm.ties) {
      if (tie.from > current) continue;
      const li = document.createElement("li");
      li.textContent = tie.text;
      ties.appendChild(li);
    }
    sheet.classList.add("realm-view");
    for (const g of realmLayer.querySelectorAll(".sm-realm")) g.classList.toggle("selected", g.dataset.id === id);
    el.scroll.scrollTop = 0;
    if (!wide.matches && sheet.offsetHeight < closedHeight() + 60) animateSheet(openHeight());
  }
  function closeRealm() {
    if (!openRealmId) return;
    openRealmId = null;
    sheet.classList.remove("realm-view");
    for (const g of realmLayer.querySelectorAll(".sm-realm")) g.classList.remove("selected");
  }

  if (realms) {
    for (const realm of realms.items) byId[realm.id] = realm;
    $("sm-main-heading").textContent = realms.mainHeading;
    $("sm-minor-heading").textContent = realms.minorHeading;
    const label = () => `${realms.toggle} ${realmsOn ? "on" : "off"}`;
    realmToggle.hidden = false;
    realmToggle.textContent = label();
    realmToggle.addEventListener("click", () => {
      realmsOn = !realmsOn;
      realmToggle.setAttribute("aria-pressed", String(realmsOn));
      realmToggle.textContent = label();
      if (!realmsOn) closeRealm();
      renderRealms(Math.max(0, current));
    });
    $("sm-realm-close").addEventListener("click", closeRealm);
    svg.addEventListener("click", (e) => {
      const g = e.target instanceof Element ? e.target.closest(".sm-realm") : null;
      if (g) openRealm(g.dataset.id);
    });
  }

  // --- people: who appears in each chapter, and a card for each ---------------------------------

  const people = story.people;
  const peopleBox = $("sm-people-box");
  const peopleChips = $("sm-people-chips");
  let openPersonId = null;

  function renderPeople(i) {
    if (!people) return;
    peopleChips.replaceChildren();
    for (const person of people.items) {
      if (!person.steps.includes(i)) continue;
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "sm-chip-button";
      chip.textContent = person.name;
      chip.addEventListener("click", () => openPerson(person.id));
      peopleChips.appendChild(chip);
    }
    peopleBox.hidden = peopleChips.children.length === 0;
  }

  function openPerson(id) {
    const person = people && people.items.find((p) => p.id === id);
    if (!person) return;
    stopPlaying();
    closeRealm();
    openPersonId = id;
    $("sm-person-name").textContent = person.name;
    $("sm-person-native").textContent = person.native || "";
    $("sm-person-role").textContent = `${person.life}. ${person.role}`;
    $("sm-person-text").textContent = person.text;
    const list = $("sm-person-steps");
    list.replaceChildren();
    for (const n of person.steps) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "sm-chip-button";
      b.style.setProperty("--phase", story.phases[steps[n].phase].color);
      const dot = document.createElement("i");
      dot.style.background = story.phases[steps[n].phase].color;
      b.append(dot, `${n + 1}. ${steps[n].title}`);
      if (n === current) b.setAttribute("aria-current", "step");
      b.addEventListener("click", () => goTo(n));
      list.appendChild(b);
    }
    sheet.classList.add("person-view");
    el.scroll.scrollTop = 0;
    if (!wide.matches && sheet.offsetHeight < closedHeight() + 60) animateSheet(openHeight());
  }
  function closePerson() {
    if (!openPersonId) return;
    openPersonId = null;
    sheet.classList.remove("person-view");
  }

  if (people) {
    $("sm-people-heading").textContent = people.heading;
    $("sm-person-close").addEventListener("click", closePerson);
  }

  // --- zoom and pan: pinch, wheel, drag, double-click, + and - ---------------------------------
  // Only the map zooms: the SVG has touch-action: none, so the browser never
  // zooms or scrolls the page for gestures that start on the map.

  // Closest zoom, in map units across the stage: a bit under twice as close as a
  // story's closest step, so pins and labels (which scale with the map) stay readable.
  const MIN_W = 110;
  const maxW = () => built.overview.w * 1.6;

  /** The map point under a stage pixel, for camera c. */
  function mapPoint(c, px, py) {
    const cw = stage.clientWidth || 390;
    const ch = stage.clientHeight || 600;
    const upp = c.w / cw;
    return [c.x - c.w / 2 + px * upp, c.y - (ch * upp) / 2 + (covered() / 2) * upp + py * upp];
  }
  /** Keep the camera's centre over the map. */
  function bounded(c) {
    return { x: Math.max(0, Math.min(MAP_W, c.x)), y: Math.max(0, Math.min(MAP_H, c.y)), w: c.w };
  }
  /** Zoom by `factor` (>1 zooms in) keeping the map point under (px, py) still. */
  function zoomAt(c, factor, px, py) {
    const cw = stage.clientWidth || 390;
    const ch = stage.clientHeight || 600;
    const w = Math.max(MIN_W, Math.min(maxW(), c.w / factor));
    const [mx, my] = mapPoint(c, px, py);
    const upp = w / cw;
    return bounded({ w, x: mx - px * upp + w / 2, y: my - py * upp + (ch * upp) / 2 - (covered() / 2) * upp });
  }

  let viewFrame = 0;
  /** Reader moves: take the camera and draw at most once a frame. */
  function setReaderCamera(c) {
    if (!readerCamera) {
      readerCamera = true;
      stopPlaying();
    }
    cancelAnimationFrame(camFrame);
    cam = c;
    if (!viewFrame) {
      viewFrame = requestAnimationFrame(() => {
        viewFrame = 0;
        applyCamera(cam);
      });
    }
  }
  const stagePoint = (e) => {
    const box = stage.getBoundingClientRect();
    return [e.clientX - box.left, e.clientY - box.top];
  };

  svg.addEventListener(
    "wheel",
    (e) => {
      e.preventDefault(); // also stops a trackpad pinch (ctrl+wheel) zooming the page
      const [px, py] = stagePoint(e);
      const lines = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1;
      setReaderCamera(zoomAt(cam, Math.exp((-e.deltaY * lines) / (e.ctrlKey ? 100 : 400)), px, py));
    },
    { passive: false },
  );

  const pointers = new Map();
  let gesture = null;
  let suppressClick = false;
  function startGesture() {
    const pts = [...pointers.values()];
    if (pts.length === 1) gesture = { kind: "pan", start: pts[0], cam: { ...cam }, moved: false };
    else if (pts.length >= 2) {
      const [a, b] = pts;
      gesture = { kind: "pinch", dist: Math.hypot(a[0] - b[0], a[1] - b[1]) || 1, mid: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], cam: { ...cam }, moved: true };
    }
  }
  svg.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return;
    // A new gesture: forget a drag that ended without a click (a pinch never fires one).
    if (!pointers.size) suppressClick = false;
    pointers.set(e.pointerId, stagePoint(e));
    // Capture only once this is a pinch: capturing on a plain tap would send its
    // click to the whole map instead of the kingdom under the finger.
    if (pointers.size >= 2) for (const id of pointers.keys()) svg.setPointerCapture?.(id);
    startGesture();
  });
  svg.addEventListener("pointermove", (e) => {
    if (!pointers.has(e.pointerId) || !gesture) return;
    pointers.set(e.pointerId, stagePoint(e));
    const pts = [...pointers.values()];
    if (gesture.kind === "pan") {
      const [x, y] = pts[0];
      const dx = x - gesture.start[0];
      const dy = y - gesture.start[1];
      if (!gesture.moved && Math.hypot(dx, dy) < 5) return; // still a tap
      if (!gesture.moved) svg.setPointerCapture?.(e.pointerId);
      gesture.moved = true;
      svg.classList.add("sm-panning");
      const upp = gesture.cam.w / (stage.clientWidth || 390);
      setReaderCamera(bounded({ x: gesture.cam.x - dx * upp, y: gesture.cam.y - dy * upp, w: gesture.cam.w }));
    } else if (pts.length >= 2) {
      const [a, b] = pts;
      const dist = Math.hypot(a[0] - b[0], a[1] - b[1]) || 1;
      const mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      // Zoom about where the pinch started, then follow the fingers' midpoint.
      const zoomed = zoomAt(gesture.cam, dist / gesture.dist, gesture.mid[0], gesture.mid[1]);
      const upp = zoomed.w / (stage.clientWidth || 390);
      setReaderCamera(bounded({ x: zoomed.x - (mid[0] - gesture.mid[0]) * upp, y: zoomed.y - (mid[1] - gesture.mid[1]) * upp, w: zoomed.w }));
    }
  });
  function endPointer(e) {
    if (!pointers.has(e.pointerId)) return;
    pointers.delete(e.pointerId);
    if (gesture && gesture.moved) suppressClick = true;
    svg.classList.remove("sm-panning");
    // Lifting one finger of a pinch carries on as a pan from where it is.
    if (pointers.size) startGesture();
    else gesture = null;
  }
  svg.addEventListener("pointerup", endPointer);
  svg.addEventListener("pointercancel", endPointer);
  // A drag or pinch that ends over a kingdom is not a click on it.
  svg.addEventListener(
    "click",
    (e) => {
      if (!suppressClick) return;
      suppressClick = false;
      e.stopImmediatePropagation();
    },
    true,
  );
  svg.addEventListener("dblclick", (e) => {
    e.preventDefault();
    const [px, py] = stagePoint(e);
    setReaderCamera(zoomAt(cam, 1.8, px, py));
  });

  /** + and - zoom about the middle of the visible map (above the sheet on phones). */
  function zoomButton(factor) {
    const cw = stage.clientWidth || 390;
    const visible = (stage.clientHeight || 600) - covered();
    readerCamera = true;
    stopPlaying();
    moveCamera(zoomAt(cam, factor, cw / 2, visible / 2), 250);
  }
  $("sm-zoom-in").addEventListener("click", () => zoomButton(1.6));
  $("sm-zoom-out").addEventListener("click", () => zoomButton(1 / 1.6));
  document.addEventListener("keydown", (e) => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    if (e.target instanceof Element && e.target.closest("input, textarea, select")) return;
    if (e.key === "+" || e.key === "=") zoomButton(1.6);
    else if (e.key === "-" || e.key === "_") zoomButton(1 / 1.6);
  });

  // --- resizing: one frame of work, however many events --------------------------------------

  let resizeQueued = false;
  function onResize() {
    if (resizeQueued) return;
    resizeQueued = true;
    requestAnimationFrame(() => {
      resizeQueued = false;
      recentre(false);
    });
  }
  window.addEventListener("resize", () => {
    if (!wide.matches && sheet.classList.contains("open") && !sheetDone) setSheetHeight(sheet.offsetHeight, closedHeight());
    onResize();
  });
  if (window.ResizeObserver) new ResizeObserver(onResize).observe(stage);
  wide.addEventListener("change", () => {
    if (wide.matches) {
      sheet.style.height = "";
      sheet.style.maxHeight = "";
    }
    onResize();
  });

  setHead(steps[0].at);
  goTo(0, { instant: true });
})((globalThis.StoryMap = globalThis.StoryMap || {}));
