/* The press. Scroll is the printing run: everything on the sheet is printed
   the moment it reaches the reading line. One scroll listener, one frame loop,
   one primitive ("ink lands on paper") reused by phrases, plates, the crystal,
   the running head and the check cards. Reduced motion: the sheet arrives
   already printed. */
(() => {
  const doc = document.documentElement;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const LINE = 0.38; // reading line, fraction of viewport height
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const strings = () => (window.bydiStrings ? window.bydiStrings() : null);

  /* ---------- registry of scroll-driven participants ---------- */

  const marks = [];   // { el, p }
  const plates = [];  // { el, p }
  const sections = [...document.querySelectorAll("[data-head]")];
  const headIndex = document.querySelector("[data-head-index]");
  const headLabel = document.querySelector("[data-head-label]");
  const runningHead = document.querySelector("[data-running-head]");
  const progressBar = document.querySelector("[data-read-progress]");
  let currentHead = "";

  function collectMarks() {
    marks.length = 0;
    document.querySelectorAll("mark.ink").forEach((el) => {
      marks.push({ el, p: -1 });
      if (reduceMotion) el.style.setProperty("--p", "1");
    });
  }

  function collectPlates() {
    document.querySelectorAll('[data-print="scroll"]').forEach((el) => {
      plates.push({ el, p: -1 });
      if (reduceMotion) el.style.setProperty("--p", "1");
    });
    document.querySelectorAll('[data-print="load"]').forEach((el) => {
      if (reduceMotion) {
        el.style.setProperty("--p", "1");
      } else if (!doc.classList.contains("cover-open")) {
        requestAnimationFrame(() => el.classList.add("is-printing"));
      }
    });
  }

  // the hero plate prints when the cover has gone
  document.addEventListener("bydi:cover-done", () => {
    document.querySelectorAll('[data-print="load"]').forEach((el) => el.classList.add("is-printing"));
  });

  /* ---------- the frame ---------- */

  let dirty = true;
  let raf = 0;
  function schedule() {
    if (!raf) raf = requestAnimationFrame(frame);
  }

  function frame() {
    raf = 0;
    if (!dirty) return;
    dirty = false;
    const vh = window.innerHeight;
    const lineY = vh * LINE;

    if (!reduceMotion) {
      for (const m of marks) {
        const r = m.el.getBoundingClientRect();
        if (r.width === 0) continue;
        // the phrase prints while it travels ~140px past the reading line
        const p = clamp((lineY + 70 - r.top) / 140, 0, 1);
        if (Math.abs(p - m.p) > 0.004) {
          m.p = p;
          m.el.style.setProperty("--p", p.toFixed(3));
          m.el.classList.toggle("is-printed", p >= 1);
        }
      }
      for (const pl of plates) {
        const r = pl.el.getBoundingClientRect();
        if (r.height === 0) continue;
        // starts as the plate enters from below the line, finishes once its top
        // has passed the line — fully printed while it is still in the reading zone
        const lead = vh * 0.28;
        const p = clamp((lineY + lead - r.top) / (lead + r.height * 0.3), 0, 1);
        if (Math.abs(p - pl.p) > 0.004) {
          pl.p = p;
          pl.el.style.setProperty("--p", p.toFixed(3));
          pl.el.classList.toggle("is-printed", p >= 1);
        }
      }
    }

    // running head: the last section whose top has passed the reading line
    let active = null;
    for (const sec of sections) {
      const r = sec.getBoundingClientRect();
      if (r.top <= lineY) active = sec;
    }
    if (active) {
      const key = active.dataset.head;
      if (key !== currentHead) {
        currentHead = key;
        setHead(active.dataset.index, key);
      }
    }

    // reading progress
    if (progressBar) {
      const max = doc.scrollHeight - vh;
      const p = max > 0 ? clamp(window.scrollY / max, 0, 1) : 0;
      progressBar.style.setProperty("--p", p.toFixed(4));
    }
  }

  function setHead(index, key) {
    const s = strings();
    if (!headIndex || !headLabel || !s) return;
    headIndex.textContent = index;
    const label = (s.head && s.head[key]) || "";
    if (runningHead && !reduceMotion) {
      runningHead.classList.remove("is-changing");
      void runningHead.offsetWidth;
      runningHead.classList.add("is-changing");
    }
    headLabel.textContent = label;
  }

  function invalidate() {
    dirty = true;
    schedule();
  }

  window.addEventListener("scroll", invalidate, { passive: true });
  window.addEventListener("resize", invalidate);
  document.addEventListener("bydi:language", () => {
    collectMarks();
    currentHead = "";
    invalidate();
    updateStepStrings();
  });

  /* ---------- decision check: one question per card ---------- */

  const form = document.querySelector("[data-decision-check]");
  const steps = form ? [...form.querySelectorAll("fieldset")] : [];
  const stepHead = form && form.querySelector("[data-step-head]");
  const stepIndex = form && form.querySelector("[data-step-index]");
  const stepLabel = form && form.querySelector("[data-step-label]");
  const stepFill = form && form.querySelector("[data-step-fill]");
  const stepNav = form && form.querySelector("[data-step-nav]");
  const backBtn = form && form.querySelector("[data-step-back]");
  const nextBtn = form && form.querySelector("[data-step-next]");
  const submitBtn = form && form.querySelector("[data-step-submit]");
  let step = 0;

  function updateStepStrings() {
    const s = strings();
    if (!form || !s || !s.steps) return;
    if (backBtn) backBtn.textContent = s.steps.back;
    if (nextBtn) nextBtn.textContent = s.steps.next;
    if (stepLabel) stepLabel.textContent = `${s.steps.question} ${step + 1} ${s.steps.of} ${steps.length}`;
  }

  function showStep(n, direction) {
    step = clamp(n, 0, steps.length - 1);
    steps.forEach((fs, i) => {
      const on = i === step;
      fs.hidden = !on;
      fs.classList.remove("is-entering");
      if (on && direction && !reduceMotion) {
        void fs.offsetWidth;
        fs.classList.add("is-entering");
      }
    });
    if (stepIndex) stepIndex.textContent = `Q${step + 1}`;
    if (stepFill) stepFill.style.setProperty("--p", ((step + 1) / steps.length).toFixed(3));
    if (backBtn) backBtn.disabled = step === 0;
    const last = step === steps.length - 1;
    if (nextBtn) nextBtn.hidden = last;
    if (submitBtn) submitBtn.hidden = !last;
    updateStepStrings();
    form.classList.toggle("is-last-step", last);
    if (direction) {
      const legend = steps[step].querySelector("legend");
      if (legend) {
        legend.setAttribute("tabindex", "-1");
        legend.focus({ preventScroll: true });
      }
      const top = form.getBoundingClientRect().top;
      if (top < 0 || top > window.innerHeight * 0.6) {
        form.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
      }
    }
  }

  function stepValid(fs) {
    const required = fs.querySelector("input[required]");
    if (!required) return true;
    return [...fs.querySelectorAll("input")].some((i) => i.checked);
  }

  if (form && steps.length > 1 && stepHead && stepNav) {
    form.classList.add("is-stepped");
    stepHead.hidden = false;
    stepNav.hidden = false;
    showStep(0, null);
    nextBtn.addEventListener("click", () => {
      const fs = steps[step];
      if (!stepValid(fs)) {
        fs.classList.remove("is-missing");
        void fs.offsetWidth;
        fs.classList.add("is-missing");
        const first = fs.querySelector("input");
        if (first) first.focus({ preventScroll: true });
        return;
      }
      showStep(step + 1, "next");
    });
    backBtn.addEventListener("click", () => showStep(step - 1, "back"));
    // a chosen radio advances on its own after a beat, like turning a card
    form.addEventListener("change", (event) => {
      const fs = event.target.closest("fieldset");
      if (!fs || fs !== steps[step]) return;
      if (event.target.type !== "radio") return;
      if (step === steps.length - 1) return;
      window.setTimeout(() => {
        if (steps[step] === fs && stepValid(fs)) showStep(step + 1, "next");
      }, reduceMotion ? 0 : 260);
    });
    // native validation only sees visible fields; the result must reach every step
    form.addEventListener("submit", (event) => {
      const missing = steps.findIndex((fs) => !stepValid(fs));
      if (missing !== -1) {
        event.preventDefault();
        event.stopImmediatePropagation();
        showStep(missing, "back");
      }
    }, true);
    form.setAttribute("novalidate", "");
  }

  // the result card prints when it appears
  const result = document.querySelector("[data-decision-result]");
  if (result && !reduceMotion) {
    const mo = new MutationObserver(() => {
      if (!result.hidden) {
        result.classList.remove("is-printing");
        void result.offsetWidth;
        result.classList.add("is-printing");
      }
    });
    mo.observe(result, { attributes: true, attributeFilter: ["hidden"] });
  }

  /* ---------- boot ---------- */

  collectMarks();
  collectPlates();
  updateStepStrings();
  invalidate();
})();
