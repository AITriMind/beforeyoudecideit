/**
 * TM-02 — the Decision Crystal.
 *
 * One component, five contexts: hero, method, wizard, result, og. It is the
 * single proprietary visual primitive, so it exists exactly once and every
 * surface reads from it.
 *
 * Two output paths share one geometry and one state table:
 *   crystalSvgMarkup()   — a pure string. Used by the build script that writes
 *                          the static SVG into the page, by the Decision Map
 *                          renderer, and by the tests.
 *   applyCrystalStates() — updates an already-rendered SVG in the browser.
 *
 * No canvas, no WebGL, no animation library: an SVG whose state is carried by
 * serialized attributes, so it is indexable, printable and renderable without
 * JavaScript.
 */

import { FACE_IDS } from './decision.js?v=26';

/** @typedef {import('./decision.js').DecisionFaceId} DecisionFaceId */
/** @typedef {import('./decision.js').DecisionFaceState} DecisionFaceState */
/** @typedef {'hero'|'method'|'wizard'|'result'|'og'} DecisionCrystalContext */

/** @type {readonly DecisionCrystalContext[]} */
export const CRYSTAL_CONTEXTS = Object.freeze(['hero', 'method', 'wizard', 'result', 'og']);

export const CRYSTAL_VIEWBOX = { width: 400, height: 400 };

/**
 * The token values, as data. The stylesheet is the normative source; a test
 * asserts these stay equal to it. A standalone SVG — one rasterized outside a
 * browser — cannot resolve `var()`, so those renders inline these literals.
 * @type {Readonly<Record<string, string>>}
 */
export const TOKEN_VALUES = Object.freeze({
  '--tm-paper': '#f3eee2',
  '--tm-paper-strong': '#e6dece',
  '--tm-surface': '#fffaf0',
  '--tm-ink': '#123c34',
  '--tm-ink-muted': '#5e6c65',
  '--tm-accent': '#9b3d47',
  '--tm-accent-soft': '#ead7d9',
  '--tm-rule': '#aaa392'
});

/**
 * Replace every `var(--token)` with its literal value.
 * @param {string} markup
 * @returns {string}
 */
export function resolveTokens(markup) {
  return markup.replace(/var\((--[a-z-]+)\)/g, (whole, name) => TOKEN_VALUES[name] || whole);
}

/**
 * An isometric hexagonal prism read as six faces: five outer bands and the
 * inner hexagon. Every face is a closed polygon in viewBox units.
 * @type {Readonly<Record<DecisionFaceId, {points: readonly (readonly [number, number])[], label: readonly [number, number], labelOnInk: boolean}>>}
 */
export const CRYSTAL_FACES = Object.freeze({
  market: {
    points: [[200, 30], [347, 115], [259, 166], [200, 132], [141, 166], [53, 115]],
    label: [200, 96],
    labelOnInk: false
  },
  team: {
    points: [[347, 115], [347, 285], [259, 234], [259, 166]],
    label: [312, 203],
    labelOnInk: false
  },
  'personal-cost': {
    points: [[347, 285], [200, 370], [200, 268], [259, 234]],
    label: [260, 322],
    labelOnInk: false
  },
  money: {
    points: [[200, 370], [53, 285], [141, 234], [200, 268]],
    label: [138, 322],
    labelOnInk: false
  },
  implementation: {
    points: [[53, 285], [53, 115], [141, 166], [141, 234]],
    label: [88, 203],
    labelOnInk: false
  },
  timing: {
    points: [[200, 132], [259, 166], [259, 234], [200, 268], [141, 234], [141, 166]],
    label: [200, 204],
    labelOnInk: true
  }
});

/** Default English face labels; a caller may pass its own. */
export const CRYSTAL_FACE_LABELS = Object.freeze({
  market: 'Market',
  money: 'Money',
  team: 'Team',
  timing: 'Timing',
  implementation: 'Implementation',
  'personal-cost': 'Personal cost'
});

/**
 * The graphical expression of each state. Every state differs from every other
 * in at least two serialized properties, so state never rests on colour alone.
 */
export const FACE_STYLE = Object.freeze({
  untested: {
    base: 'var(--tm-paper)',
    hatch: 'untested',
    hatchOpacity: 0.22,
    stroke: 'var(--tm-ink)',
    strokeWidth: 1,
    strokeOpacity: 0.55,
    dash: '',
    fracture: 0,
    node: null
  },
  tested: {
    base: '#dce4d8',
    hatch: 'tested',
    hatchOpacity: 0.3,
    stroke: 'var(--tm-ink)',
    strokeWidth: 1.5,
    strokeOpacity: 1,
    dash: '',
    fracture: 0,
    node: { r: 2, fill: 'var(--tm-ink)', stroke: 'none', strokeWidth: 0 }
  },
  unresolved: {
    base: 'var(--tm-paper-strong)',
    hatch: 'unresolved',
    hatchOpacity: 0.24,
    stroke: 'var(--tm-ink)',
    strokeWidth: 1.5,
    strokeOpacity: 1,
    dash: '5 4',
    fracture: 0,
    node: { r: 2, fill: 'none', stroke: 'var(--tm-ink)', strokeWidth: 1 }
  },
  contradicted: {
    base: 'var(--tm-accent-soft)',
    hatch: 'contradicted',
    hatchOpacity: 0.42,
    stroke: 'var(--tm-accent)',
    strokeWidth: 2,
    strokeOpacity: 1,
    dash: '',
    fracture: 1,
    node: { r: 2.5, fill: 'var(--tm-accent)', stroke: 'none', strokeWidth: 0 }
  },
  committed: {
    base: 'var(--tm-ink)',
    hatch: null,
    hatchOpacity: 0,
    stroke: 'var(--tm-ink)',
    strokeWidth: 2,
    strokeOpacity: 1,
    dash: '',
    fracture: 0,
    node: { r: 2.5, fill: 'var(--tm-paper)', stroke: 'none', strokeWidth: 0 }
  }
});

/** Hatch patterns, one per hatching state. */
const HATCH = Object.freeze({
  untested: { spacing: 12, cross: false, stroke: 'var(--tm-ink)' },
  tested: { spacing: 8, cross: false, stroke: 'var(--tm-ink)' },
  unresolved: { spacing: 10, cross: true, stroke: 'var(--tm-ink)' },
  contradicted: { spacing: 5, cross: true, stroke: 'var(--tm-accent)' }
});

/** @typedef {'TEST'|'MARK_UNRESOLVED'|'CONTRADICT'|'COMMIT'|'RESET'} CrystalEvent */

/** Allowed transitions. Anything absent leaves the face where it is. */
const TRANSITIONS = Object.freeze({
  untested: { TEST: 'tested', MARK_UNRESOLVED: 'unresolved', CONTRADICT: 'contradicted' },
  tested: { MARK_UNRESOLVED: 'unresolved', CONTRADICT: 'contradicted', COMMIT: 'committed' },
  unresolved: { TEST: 'tested', CONTRADICT: 'contradicted' },
  contradicted: { TEST: 'tested', MARK_UNRESOLVED: 'unresolved' },
  committed: { CONTRADICT: 'contradicted' }
});

/**
 * @param {DecisionFaceState} state
 * @param {CrystalEvent} event
 * @returns {DecisionFaceState}
 */
export function transition(state, event) {
  if (event === 'RESET') return 'untested';
  const row = TRANSITIONS[state];
  return (row && row[event]) || state;
}

/**
 * The serialized attributes a face carries for a state. The renderer writes
 * these and the browser updater rewrites exactly the same set, so the DOM after
 * an update is identical to the DOM the build would have produced.
 *
 * @param {DecisionFaceState} state
 * @returns {Record<string, string>}
 */
export function faceAttributes(state) {
  const s = FACE_STYLE[state] || FACE_STYLE.untested;
  return {
    'data-face-state': state,
    baseFill: s.base,
    hatchFill: s.hatch ? `hatch-${s.hatch}` : 'none',
    hatchOpacity: String(s.hatchOpacity),
    stroke: s.stroke,
    'stroke-width': String(s.strokeWidth),
    'stroke-opacity': String(s.strokeOpacity),
    'stroke-dasharray': s.dash,
    fractureOpacity: String(s.fracture),
    nodeR: s.node ? String(s.node.r) : '0',
    nodeFill: s.node ? s.node.fill : 'none',
    nodeStroke: s.node ? s.node.stroke : 'none',
    nodeStrokeWidth: s.node ? String(s.node.strokeWidth) : '0',
    nodeOpacity: s.node ? '1' : '0'
  };
}

/* ---------- geometry helpers ---------- */

const path = (points) => `${points.map(([x, y], i) => `${i ? 'L' : 'M'}${x} ${y}`).join(' ')} Z`;

function centroid(points) {
  const x = points.reduce((sum, p) => sum + p[0], 0) / points.length;
  const y = points.reduce((sum, p) => sum + p[1], 0) / points.length;
  return [x, y];
}

/**
 * A three-segment crack across the face, derived from its own geometry so the
 * fracture always sits inside the face it belongs to. Deterministic.
 * @param {readonly (readonly [number, number])[]} points
 */
function fracturePath(points) {
  const [cx, cy] = centroid(points);
  const spread = Math.max(...points.map(([x, y]) => Math.hypot(x - cx, y - cy))) * 0.62;
  const segments = [
    [cx - spread * 0.9, cy - spread * 0.55],
    [cx - spread * 0.15, cy - spread * 0.05],
    [cx - spread * 0.42, cy + spread * 0.35],
    [cx + spread * 0.55, cy + spread * 0.72]
  ];
  return segments.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
}

const esc = (value) =>
  String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/* ---------- markup ---------- */

/**
 * @param {object} options
 * @param {DecisionCrystalContext} options.context
 * @param {Record<DecisionFaceId, DecisionFaceState>} options.states
 * @param {string} [options.idPrefix] defaults to the context, so two instances
 *   on one page never collide on a DOM id
 * @param {boolean} [options.showLabels]
 * @param {boolean} [options.decorative]
 * @param {string} [options.title] required unless decorative
 * @param {string} [options.className]
 * @param {Record<string, string>} [options.labels]
 * @param {Record<string, string>} [options.labelI18nKeys] when the host page
 *   translates in the browser, each label also carries its dictionary key
 * @param {boolean} [options.standalone] inline token literals, for renderers
 *   with no CSS custom properties
 * @param {number} [options.size] explicit width and height in px; a nested SVG
 *   without them fills its parent instead of its box
 * @returns {string} standalone SVG markup
 */
export function crystalSvgMarkup({
  context,
  states,
  idPrefix,
  showLabels = true,
  decorative = false,
  title = '',
  className = '',
  labels = CRYSTAL_FACE_LABELS,
  labelI18nKeys = null,
  standalone = false,
  size = 0
}) {
  if (!CRYSTAL_CONTEXTS.includes(context)) throw new Error(`unknown crystal context: ${context}`);
  const prefix = idPrefix || `tm-crystal-${context}`;
  const usedHatches = new Set();
  for (const id of FACE_IDS) {
    const style = FACE_STYLE[states[id]] || FACE_STYLE.untested;
    if (style.hatch) usedHatches.add(style.hatch);
  }

  const clips = FACE_IDS.map(
    (faceId) =>
      `<clipPath id="${prefix}-clip-${faceId}"><path d="${path(CRYSTAL_FACES[faceId].points)}"/></clipPath>`
  ).join('');

  const defs = [...usedHatches]
    .map((name) => {
      const { spacing, cross, stroke } = HATCH[name];
      const lines = cross
        ? `<path d="M0 0 L${spacing} ${spacing}" stroke="${stroke}" stroke-width="1"/><path d="M${spacing} 0 L0 ${spacing}" stroke="${stroke}" stroke-width="1"/>`
        : `<path d="M-1 1 L1 -1 M0 ${spacing} L${spacing} 0 M${spacing - 1} ${spacing + 1} L${spacing + 1} ${spacing - 1}" stroke="${stroke}" stroke-width="1"/>`;
      return `<pattern id="${prefix}-hatch-${name}" width="${spacing}" height="${spacing}" patternUnits="userSpaceOnUse">${lines}</pattern>`;
    })
    .join('');

  const faces = FACE_IDS.map((faceId) => {
    const face = CRYSTAL_FACES[faceId];
    const state = states[faceId] || 'untested';
    const a = faceAttributes(state);
    const d = path(face.points);
    const [nx, ny] = centroid(face.points);
    const hatchFill = a.hatchFill === 'none' ? 'none' : `url(#${prefix}-${a.hatchFill})`;
    return [
      `<g class="tm-crystal__face" data-face-id="${faceId}" data-face-state="${state}">`,
      `<path class="tm-crystal__face-base" d="${d}" fill="${a.baseFill}"/>`,
      `<path class="tm-crystal__face-hatch" d="${d}" fill="${hatchFill}" opacity="${a.hatchOpacity}"/>`,
      `<path class="tm-crystal__face-shape" d="${d}" fill="none" stroke="${a.stroke}" stroke-width="${a['stroke-width']}" stroke-opacity="${a['stroke-opacity']}"${a['stroke-dasharray'] ? ` stroke-dasharray="${a['stroke-dasharray']}"` : ''} stroke-linejoin="round"/>`,
      `<path class="tm-crystal__fracture" clip-path="url(#${prefix}-clip-${faceId})" d="${fracturePath(face.points)}" fill="none" stroke="var(--tm-accent)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" opacity="${a.fractureOpacity}"/>`,
      `<circle class="tm-crystal__node" cx="${nx.toFixed(1)}" cy="${(ny + (faceId === 'timing' ? 22 : 16)).toFixed(1)}" r="${a.nodeR}" fill="${a.nodeFill}" stroke="${a.nodeStroke}" stroke-width="${a.nodeStrokeWidth}" opacity="${a.nodeOpacity}"/>`,
      '</g>'
    ].join('');
  }).join('');

  const labelMarkup = showLabels
    ? FACE_IDS.map((faceId) => {
        const face = CRYSTAL_FACES[faceId];
        const onInk = states[faceId] === 'committed' || face.labelOnInk;
        const i18n = labelI18nKeys && labelI18nKeys[faceId] ? ` data-i18n="${esc(labelI18nKeys[faceId])}"` : '';
        return `<text class="tm-crystal__label${onInk ? ' is-on-ink' : ''}" data-face-label="${faceId}"${i18n} x="${face.label[0]}" y="${face.label[1]}" text-anchor="middle">${esc(labels[faceId] || CRYSTAL_FACE_LABELS[faceId])}</text>`;
      }).join('')
    : '';

  const titleId = `${prefix}-title`;
  const a11y = decorative
    ? 'aria-hidden="true" focusable="false"'
    : `role="img" aria-labelledby="${titleId}"`;
  const titleEl = decorative ? '' : `<title id="${titleId}">${esc(title || 'The Decision Crystal')}</title>`;

  const markup = [
    `<svg class="tm-crystal tm-crystal--${context}${className ? ` ${className}` : ''}" data-crystal-context="${context}"${size ? ` width="${size}" height="${size}"` : ''} viewBox="0 0 ${CRYSTAL_VIEWBOX.width} ${CRYSTAL_VIEWBOX.height}" xmlns="http://www.w3.org/2000/svg" ${a11y}>`,
    titleEl,
    `<defs>${clips}${defs}</defs>`,
    faces,
    labelMarkup,
    '</svg>'
  ].join('');
  return standalone ? resolveTokens(markup) : markup;
}

/**
 * Rewrite an already-rendered crystal in place. Only the attributes listed in
 * `faceAttributes` are touched, so a DOM updated here is byte-equivalent to one
 * the build script would have produced for the same states.
 *
 * @param {Element} svg
 * @param {Record<DecisionFaceId, DecisionFaceState>} states
 */
export function applyCrystalStates(svg, states) {
  if (!svg) return;
  const prefix = svg.querySelector('title')?.id.replace(/-title$/, '') || svg.dataset.crystalContext;
  ensureHatchPatterns(svg, states, prefix);
  for (const faceId of FACE_IDS) {
    const group = svg.querySelector(`[data-face-id="${faceId}"]`);
    if (!group) continue;
    const state = states[faceId] || 'untested';
    if (group.getAttribute('data-face-state') === state) continue;
    const a = faceAttributes(state);
    group.setAttribute('data-face-state', state);
    const base = group.querySelector('.tm-crystal__face-base');
    const hatch = group.querySelector('.tm-crystal__face-hatch');
    const shape = group.querySelector('.tm-crystal__face-shape');
    const fracture = group.querySelector('.tm-crystal__fracture');
    const node = group.querySelector('.tm-crystal__node');
    if (base) base.setAttribute('fill', a.baseFill);
    if (hatch) {
      hatch.setAttribute('fill', a.hatchFill === 'none' ? 'none' : `url(#${prefix}-${a.hatchFill})`);
      hatch.setAttribute('opacity', a.hatchOpacity);
    }
    if (shape) {
      shape.setAttribute('stroke', a.stroke);
      shape.setAttribute('stroke-width', a['stroke-width']);
      shape.setAttribute('stroke-opacity', a['stroke-opacity']);
      if (a['stroke-dasharray']) shape.setAttribute('stroke-dasharray', a['stroke-dasharray']);
      else shape.removeAttribute('stroke-dasharray');
    }
    if (fracture) fracture.setAttribute('opacity', a.fractureOpacity);
    if (node) {
      node.setAttribute('r', a.nodeR);
      node.setAttribute('fill', a.nodeFill);
      node.setAttribute('stroke', a.nodeStroke);
      node.setAttribute('stroke-width', a.nodeStrokeWidth);
      node.setAttribute('opacity', a.nodeOpacity);
    }
    const label = svg.querySelector(`[data-face-label="${faceId}"]`);
    if (label) {
      label.classList.toggle('is-on-ink', state === 'committed' || CRYSTAL_FACES[faceId].labelOnInk);
    }
  }
}

/**
 * The static markup only carries the patterns its initial states needed; a run
 * time state change may ask for one that was never emitted.
 * @param {Element} svg
 * @param {Record<DecisionFaceId, DecisionFaceState>} states
 * @param {string} prefix
 */
function ensureHatchPatterns(svg, states, prefix) {
  const defs = svg.querySelector('defs');
  if (!defs) return;
  const doc = svg.ownerDocument;
  const NS = 'http://www.w3.org/2000/svg';
  for (const faceId of FACE_IDS) {
    const style = FACE_STYLE[states[faceId]] || FACE_STYLE.untested;
    if (!style.hatch) continue;
    const id = `${prefix}-hatch-${style.hatch}`;
    if (svg.querySelector(`#${CSS.escape(id)}`)) continue;
    const { spacing, cross, stroke } = HATCH[style.hatch];
    const pattern = doc.createElementNS(NS, 'pattern');
    pattern.setAttribute('id', id);
    pattern.setAttribute('width', String(spacing));
    pattern.setAttribute('height', String(spacing));
    pattern.setAttribute('patternUnits', 'userSpaceOnUse');
    const specs = cross
      ? [`M0 0 L${spacing} ${spacing}`, `M${spacing} 0 L0 ${spacing}`]
      : [`M-1 1 L1 -1 M0 ${spacing} L${spacing} 0 M${spacing - 1} ${spacing + 1} L${spacing + 1} ${spacing - 1}`];
    for (const d of specs) {
      const line = doc.createElementNS(NS, 'path');
      line.setAttribute('d', d);
      line.setAttribute('stroke', stroke);
      line.setAttribute('stroke-width', '1');
      pattern.appendChild(line);
    }
    defs.appendChild(pattern);
  }
}
