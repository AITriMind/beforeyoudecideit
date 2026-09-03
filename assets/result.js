/**
 * TM-05 — the result surface and the scheduling transition.
 *
 * The result is the product: the six faces, what does not hold, and the one
 * test to run next. The calendar is a second, explicit step, and nothing of the
 * provider's loads before someone asks for it.
 *
 * The owner's blind-spot paragraph keeps its place; what is added around it is
 * derived from the same Decision the crystal reads.
 */

import { FACE_IDS } from './domain/decision.js?v=26';
import { decisionFrom } from './domain/derive.js?v=26';
import { decisionMapSvg } from './domain/decision-map.js?v=26';
import {
  SCHEDULER_TIMEOUT_MS,
  bookingUrl,
  providerAllowed,
  schedulerTransition
} from './domain/scheduler.js?v=26';

const result = document.querySelector('[data-decision-result]');
const form = document.querySelector('[data-decision-check]');
if (result && form) {
  const facesEl = result.querySelector('[data-result-faces]');
  const findingsEl = result.querySelector('[data-result-findings]');
  const nextTestEl = result.querySelector('[data-result-next-test]');
  const downloadEl = result.querySelector('[data-map-download]');
  const scheduler = document.querySelector('[data-scheduler]');
  const bookCta = result.querySelector('[data-book-call]');

  const state = { derived: null, optionIds: [], scheduler: 'closed', timer: 0, mapUrl: '' };

  const strings = () => (window.bydiStrings ? window.bydiStrings() : null);
  const lookup = (source, path) => path.split('.').reduce((node, key) => node?.[key], source);
  const pascal = (id) => id.replace(/(^|-)([a-z])/g, (_, __, c) => c.toUpperCase());

  document.addEventListener('bydi:derived', (event) => {
    state.derived = event.detail.derived;
    state.optionIds = event.detail.optionIds;
    if (!result.hidden) render();
  });

  /* ---------- the result ---------- */

  function render() {
    const s = strings();
    if (!s || !state.derived) return;

    // the six faces, in fixed order, as text — the plate is never the only copy
    if (facesEl) {
      facesEl.textContent = '';
      for (const id of FACE_IDS) {
        const faceState = state.derived.faceStates[id];
        const row = document.createElement('li');
        row.className = 'result-face';
        row.dataset.faceId = id;
        row.dataset.faceState = faceState;
        const name = document.createElement('span');
        name.textContent = lookup(s, `crystal.face${pascal(id)}`) || id;
        const value = document.createElement('span');
        value.className = 'result-face__state';
        value.textContent = lookup(s, `faces.${faceState}`) || faceState;
        row.append(name, value);
        facesEl.append(row);
      }
    }

    // findings: the break first, a second one if there is one
    if (findingsEl) {
      findingsEl.textContent = '';
      const findings = state.derived.findings.slice(0, 2);
      if (!findings.length) {
        const none = document.createElement('p');
        none.className = 'result-finding__none';
        none.textContent = lookup(s, 'result.noFindings');
        findingsEl.append(none);
      }
      for (const finding of findings) {
        const block = document.createElement('div');
        block.className = 'result-finding';
        block.dataset.findingCode = finding.code;
        const title = document.createElement('h4');
        // the label carries the severity in words; red alone never does
        title.dataset.findingLabel =
          finding.priority === 1 ? lookup(s, 'plate.riskLabel') : lookup(s, 'plate.roleFinding');
        title.textContent = lookup(s, finding.titleKey);
        const body = document.createElement('p');
        body.textContent = lookup(s, finding.bodyKey);
        block.append(title, body);
        findingsEl.append(block);
      }
    }

    if (nextTestEl) {
      nextTestEl.textContent = lookup(s, state.derived.nextTestKey) || '';
    }

    if (downloadEl) prepareDownload(s);
  }

  /* ---------- the map, built in the browser from the same module ---------- */

  function prepareDownload(s) {
    if (state.mapUrl) URL.revokeObjectURL(state.mapUrl);
    state.mapUrl = '';
    downloadEl.hidden = true;
    const typeLabel = selectedLabel(s, 'decisionType');
    if (!typeLabel) return;
    try {
      const decision = decisionFrom(state.optionIds, {
        id: 'local',
        title: capitalize(typeLabel),
        copy: s
      });
      const svg = decisionMapSvg(decision, 'decision-map', {
        nextTest: lookup(s, state.derived.nextTestKey) || '',
        faceLabels: Object.fromEntries(FACE_IDS.map((id) => [id, lookup(s, `crystal.face${pascal(id)}`)])),
        faceStateLabels: Object.fromEntries(
          ['untested', 'tested', 'unresolved', 'contradicted', 'committed'].map((key) => [
            key,
            lookup(s, `faces.${key}`)
          ])
        )
      });
      state.mapUrl = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
      downloadEl.href = state.mapUrl;
      downloadEl.download = 'decision-map.svg';
      downloadEl.hidden = false;
    } catch {
      // an incomplete check simply has no map yet; the text result stands alone
    }
  }

  function selectedLabel(s, inputName) {
    const input = form.querySelector(`[name="${inputName}"]:checked`);
    if (!input) return '';
    const span = input.closest('.choice')?.querySelector('span');
    return span ? span.textContent.trim() : String(input.value);
  }

  const capitalize = (value) => value.charAt(0).toUpperCase() + value.slice(1);

  /* ---------- the scheduler ---------- */

  function setScheduler(event) {
    const next = schedulerTransition(state.scheduler, event);
    if (next === state.scheduler) return;
    state.scheduler = next;
    if (!scheduler) return;
    scheduler.dataset.state = next;
    scheduler.hidden = next === 'closed';

    const frame = scheduler.querySelector('[data-scheduler-frame]');
    if (!providerAllowed(next)) {
      window.clearTimeout(state.timer);
      if (frame) frame.textContent = '';
    }

    if (next === 'loading' && frame) {
      const url = currentBookingUrl();
      if (!url) {
        setScheduler('FAIL');
        return;
      }
      const iframe = document.createElement('iframe');
      iframe.title = 'Schedule a 30-minute decision stress test';
      iframe.src = url;
      iframe.loading = 'lazy';
      iframe.addEventListener('load', () => setScheduler('READY'));
      frame.textContent = '';
      frame.append(iframe);
      state.timer = window.setTimeout(() => setScheduler('FAIL'), SCHEDULER_TIMEOUT_MS);
    }

    if (next === 'open') window.clearTimeout(state.timer);

    if (next === 'closed' && bookCta) bookCta.focus({ preventScroll: true });
    if (next === 'transition') scheduler.querySelector('[data-scheduler-open]')?.focus({ preventScroll: true });
  }

  function currentBookingUrl() {
    if (!state.derived) return form.dataset.calendlyUrl || '';
    const answers = {
      a1: selectedLabel(strings(), 'decisionType'),
      a2: selectedLabel(strings(), 'whyNow'),
      a4: selectedLabel(strings(), 'clarityBlock')
    };
    return bookingUrl(form.dataset.calendlyUrl || '', answers);
  }

  if (scheduler) {
    const fallback = scheduler.querySelector('[data-scheduler-fallback]');
    if (bookCta) {
      bookCta.addEventListener('click', (event) => {
        event.preventDefault();
        setScheduler('ACTIVATE');
        scheduler.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }
    scheduler.querySelector('[data-scheduler-open]')?.addEventListener('click', () => setScheduler('OPEN'));
    scheduler.querySelector('[data-scheduler-close]')?.addEventListener('click', () => setScheduler('CLOSE'));
    scheduler.querySelector('[data-scheduler-retry]')?.addEventListener('click', () => setScheduler('RETRY'));
    if (fallback) {
      const url = form.dataset.calendlyUrl || '';
      if (url && !url.includes('{{')) fallback.href = url;
    }
    scheduler.hidden = true;
    scheduler.dataset.state = 'closed';
  }

  document.addEventListener('bydi:language', () => {
    if (!result.hidden) render();
  });

  // the result appears when the check completes; render before it is shown
  const shown = new MutationObserver(() => {
    if (!result.hidden) render();
  });
  shown.observe(result, { attributes: true, attributeFilter: ['hidden'] });
}
