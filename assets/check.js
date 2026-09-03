/**
 * TM-03 — the wizard, wired to the domain.
 *
 * The six fieldsets in the page are the owner's; nothing here rewrites them.
 * This module reads what has been answered, derives the six face states through
 * the canonical rules, and moves the crystal beside the questions. Every answer
 * change recomputes everything from scratch, so a contradiction can never latch
 * from a previous answer vector.
 *
 * The crystal is already in the page as final SVG. Without this module the page
 * still shows six untested faces and the check still works.
 */

import { FACE_IDS } from './domain/decision.js';
import { applyCrystalStates } from './domain/crystal.js';
import { QUESTION_BY_INPUT_NAME, categoryFor, optionIdFor } from './domain/check-config.js';
import { derive } from './domain/derive.js';

const form = document.querySelector('[data-decision-check]');
const crystal = document.querySelector('[data-wizard-crystal] .tm-crystal');
const legend = document.querySelector('[data-face-legend]');
if (form && crystal) {
  const state = { derived: null, selected: [] };

  /** Selected option ids, read from the DOM the owner authored. */
  function selectedOptionIds() {
    const data = new FormData(form);
    const ids = [];
    for (const inputName of Object.keys(QUESTION_BY_INPUT_NAME)) {
      for (const value of data.getAll(inputName)) {
        const id = optionIdFor(inputName, String(value));
        if (id) ids.push(id);
      }
    }
    return ids;
  }

  function strings() {
    return window.bydiStrings ? window.bydiStrings() : null;
  }

  function renderLegend() {
    if (!legend || !state.derived) return;
    const s = strings();
    if (!s || !s.faces) return;
    const counts = new Map();
    for (const id of FACE_IDS) {
      const faceState = state.derived.faceStates[id];
      counts.set(faceState, (counts.get(faceState) || 0) + 1);
    }
    const parts = [];
    for (const key of ['tested', 'unresolved', 'contradicted', 'committed', 'untested']) {
      const n = counts.get(key);
      if (n) parts.push(`${n} ${s.faces[key]}`);
    }
    legend.textContent = parts.join(' · ');
  }

  function update() {
    state.selected = selectedOptionIds();
    state.derived = derive(state.selected);
    applyCrystalStates(crystal, state.derived.faceStates);
    renderLegend();
    // the result surface reads this; nothing is persisted and nothing is sent
    form.dataset.category = categoryFor(state.selected);
    document.dispatchEvent(
      new CustomEvent('bydi:derived', { detail: { derived: state.derived, optionIds: state.selected } })
    );
  }

  form.addEventListener('change', update);
  document.addEventListener('bydi:language', renderLegend);
  update();
}
