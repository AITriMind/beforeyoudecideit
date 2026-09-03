/**
 * TM-02 — the Decision Crystal: state machine, serialized state expression,
 * and the acceptance criteria that can be asserted on markup.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { FACE_IDS } from '../assets/domain/decision.js';
import {
  CRYSTAL_CONTEXTS,
  CRYSTAL_FACES,
  FACE_STYLE,
  crystalSvgMarkup,
  faceAttributes,
  transition
} from '../assets/domain/crystal.js';

const allUntested = () => Object.fromEntries(FACE_IDS.map((id) => [id, 'untested']));

test('the five contexts are exactly the ones the spec names', () => {
  assert.deepEqual([...CRYSTAL_CONTEXTS], ['hero', 'method', 'wizard', 'result', 'og']);
});

test('geometry defines all six faces', () => {
  assert.deepEqual(Object.keys(CRYSTAL_FACES).sort(), [...FACE_IDS].sort());
  for (const id of FACE_IDS) {
    assert.ok(CRYSTAL_FACES[id].points.length >= 3, `${id} needs a closed polygon`);
  }
});

test('rendered markup carries all six stable data-face-id values', () => {
  const svg = crystalSvgMarkup({ context: 'method', states: allUntested(), title: 'x' });
  for (const id of FACE_IDS) {
    assert.match(svg, new RegExp(`data-face-id="${id}"`));
  }
});

test('the state machine follows the documented transition table', () => {
  assert.equal(transition('untested', 'TEST'), 'tested');
  assert.equal(transition('untested', 'MARK_UNRESOLVED'), 'unresolved');
  assert.equal(transition('untested', 'CONTRADICT'), 'contradicted');
  assert.equal(transition('tested', 'MARK_UNRESOLVED'), 'unresolved');
  assert.equal(transition('tested', 'CONTRADICT'), 'contradicted');
  assert.equal(transition('tested', 'COMMIT'), 'committed');
  assert.equal(transition('unresolved', 'TEST'), 'tested');
  assert.equal(transition('unresolved', 'CONTRADICT'), 'contradicted');
  assert.equal(transition('contradicted', 'TEST'), 'tested');
  assert.equal(transition('contradicted', 'MARK_UNRESOLVED'), 'unresolved');
  assert.equal(transition('committed', 'CONTRADICT'), 'contradicted');
  for (const state of Object.keys(FACE_STYLE)) {
    assert.equal(transition(state, 'RESET'), 'untested');
  }
});

test('transitions the table does not allow preserve the current state', () => {
  assert.equal(transition('untested', 'COMMIT'), 'untested');
  assert.equal(transition('unresolved', 'COMMIT'), 'unresolved');
  assert.equal(transition('contradicted', 'COMMIT'), 'contradicted');
  assert.equal(transition('committed', 'TEST'), 'committed');
  assert.equal(transition('committed', 'MARK_UNRESOLVED'), 'committed');
});

test('every allowed transition changes at least two serialized properties', () => {
  const watched = ['hatchFill', 'stroke-width', 'stroke-dasharray', 'fractureOpacity', 'nodeOpacity', 'nodeFill', 'nodeR'];
  const events = ['TEST', 'MARK_UNRESOLVED', 'CONTRADICT', 'COMMIT', 'RESET'];
  let checked = 0;
  for (const from of Object.keys(FACE_STYLE)) {
    for (const event of events) {
      const to = transition(from, event);
      if (to === from) continue;
      const a = faceAttributes(from);
      const b = faceAttributes(to);
      const changed = watched.filter((key) => a[key] !== b[key]);
      assert.ok(
        changed.length >= 2,
        `${from} --${event}--> ${to} changed only [${changed.join(', ')}]`
      );
      checked += 1;
    }
  }
  assert.ok(checked >= 15, `expected the full transition matrix, walked ${checked}`);
});

test('no two states share the same serialized expression', () => {
  const seen = new Map();
  for (const state of Object.keys(FACE_STYLE)) {
    const key = JSON.stringify(faceAttributes(state));
    assert.equal(seen.has(key), false, `${state} is indistinguishable from ${seen.get(key)}`);
    seen.set(key, state);
  }
});

test('state is never carried by colour alone', () => {
  // hatch, outline weight, dash, fracture and node differ across states
  const shapes = Object.keys(FACE_STYLE).map((state) => {
    const a = faceAttributes(state);
    return [a.hatchFill, a['stroke-width'], a['stroke-dasharray'], a.fractureOpacity, a.nodeR, a.nodeOpacity].join('|');
  });
  assert.equal(new Set(shapes).size, shapes.length);
});

test('a contradicted face renders a visible fracture and a tested one does not', () => {
  const states = { ...allUntested(), market: 'contradicted', money: 'tested' };
  const svg = crystalSvgMarkup({ context: 'result', states, title: 'x' });
  const market = svg.slice(svg.indexOf('data-face-id="market"'), svg.indexOf('data-face-id="team"'));
  assert.match(market, /class="tm-crystal__fracture"[^>]*opacity="1"/);
  const money = svg.slice(svg.indexOf('data-face-id="money"'), svg.indexOf('data-face-id="implementation"'));
  assert.match(money, /class="tm-crystal__fracture"[^>]*opacity="0"/);
});

test('two instances on one page produce no duplicate DOM ids', () => {
  const states = { ...allUntested(), market: 'unresolved', team: 'contradicted' };
  const a = crystalSvgMarkup({ context: 'hero', states, decorative: true });
  const b = crystalSvgMarkup({ context: 'method', states, title: 'x' });
  const ids = [...`${a}${b}`.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
  assert.ok(ids.length > 0, 'expected pattern and title ids');
  assert.equal(new Set(ids).size, ids.length, `duplicate ids: ${ids.join(', ')}`);
});

test('a decorative instance is hidden and has no title; a semantic one is labelled', () => {
  const decorative = crystalSvgMarkup({ context: 'hero', states: allUntested(), decorative: true });
  assert.match(decorative, /aria-hidden="true"/);
  assert.doesNotMatch(decorative, /<title/);
  const semantic = crystalSvgMarkup({ context: 'method', states: allUntested(), title: 'The Decision Crystal: six faces' });
  assert.match(semantic, /role="img"/);
  assert.match(semantic, /<title id="tm-crystal-method-title">The Decision Crystal: six faces<\/title>/);
  assert.match(semantic, /aria-labelledby="tm-crystal-method-title"/);
});

test('markup contains no canvas and no script', () => {
  const svg = crystalSvgMarkup({ context: 'og', states: allUntested(), title: 'x' });
  assert.doesNotMatch(svg, /<canvas|<script|webgl/i);
});

test('rendering is deterministic for the same input', () => {
  const states = { ...allUntested(), timing: 'committed', team: 'contradicted' };
  const once = crystalSvgMarkup({ context: 'og', states, title: 'x' });
  const twice = crystalSvgMarkup({ context: 'og', states, title: 'x' });
  assert.equal(once, twice);
});

test('an unknown context is rejected', () => {
  assert.throws(() => crystalSvgMarkup({ context: 'poster', states: allUntested() }), /unknown crystal context/);
});

test('labels can be supplied per language and are escaped', () => {
  const svg = crystalSvgMarkup({
    context: 'method',
    states: allUntested(),
    title: 'x',
    labels: { ...Object.fromEntries(FACE_IDS.map((id) => [id, id])), market: 'Рынок & <co>' }
  });
  assert.match(svg, /data-face-label="market"[^>]*>Рынок &amp; &lt;co&gt;</);
});
