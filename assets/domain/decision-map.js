/**
 * TM-04 — the Decision Map, as a deterministic 1600x900 plate.
 *
 * Two variants share one layout, one schema and one crystal: `decision-map` is
 * the artifact a person leaves with, `og` is what a link preview shows. Neither
 * reconstructs anything: both read a `Decision` and render the same component.
 *
 * The output is a pure string. Rasterizing it is a separate step, so the same
 * input always produces the same bytes.
 */

import { FACE_IDS } from './decision.js';
import { TOKEN_VALUES, crystalSvgMarkup } from './crystal.js';

/** @typedef {'decision-map'|'og'} DecisionPlateVariant */

export const PLATE = Object.freeze({
  width: 1600,
  height: 900,
  margin: 96,
  metaBaseline: 86,
  titleX: 96,
  titleY: 188,
  titleMaxWidth: 790,
  titleSize: 72,
  titleLeading: 0.98,
  findingsX: 96,
  findingsY: 356,
  findingsWidth: 760,
  nextTestX: 96,
  nextTestLabelY: 590,
  nextTestBodyY: 632,
  crystalX: 1030,
  crystalY: 160,
  crystalWidth: 450,
  crystalHeight: 325,
  legendX: 1040,
  legendY: 520,
  footerRuleY: 814,
  footerTextY: 852,
  safe: { minX: 64, maxX: 1536, minY: 48, maxY: 868 }
});

/**
 * The renderer runs outside a browser, where no brand font is installed. This
 * is the specification's `font-fallback` state made explicit: one deterministic
 * stack, named here rather than inherited from the host.
 */
/* Family names are single-quoted: the stack is written into an SVG attribute
   delimited by double quotes. */
export const PLATE_FONTS = Object.freeze({
  display: "Literata, Georgia, 'Times New Roman', serif",
  body: "'IBM Plex Sans', Georgia, 'Times New Roman', serif",
  mono: "'IBM Plex Mono', 'Courier New', Courier, monospace"
});

export const PLATE_STRINGS = Object.freeze({
  plateLabel: 'DECISION MAP',
  noFindings: 'No structural contradiction detected',
  footer: 'TRIMIND / DECISION STRESS TEST',
  ruleset: (version) => `RULESET ${version}`
});

/** Rough advance width per character, as a fraction of the font size. */
const ADVANCE = { display: 0.5, body: 0.52, mono: 0.6 };

const esc = (value) =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/**
 * Break text to a pixel budget without measuring glyphs, so the result is the
 * same in every environment.
 *
 * @param {string} text
 * @param {number} maxWidth
 * @param {number} fontSize
 * @param {'display'|'body'|'mono'} face
 * @param {number} maxLines
 * @returns {readonly string[]}
 */
export function wrapText(text, maxWidth, fontSize, face, maxLines = Infinity) {
  const perChar = fontSize * ADVANCE[face];
  const budget = Math.max(1, Math.floor(maxWidth / perChar));
  const lines = [];
  let line = '';
  for (const word of String(text).split(/\s+/).filter(Boolean)) {
    const candidate = line ? `${line} ${word}` : word;
    if (candidate.length <= budget || !line) {
      line = candidate;
    } else {
      lines.push(line);
      line = word;
    }
    if (lines.length === maxLines) break;
  }
  if (line && lines.length < maxLines) lines.push(line);
  if (lines.length === maxLines && Number.isFinite(maxLines)) {
    const consumed = lines.join(' ').split(/\s+/).length;
    const total = String(text).split(/\s+/).filter(Boolean).length;
    if (consumed < total) {
      const last = lines[lines.length - 1];
      lines[lines.length - 1] = `${last.slice(0, Math.max(0, budget - 1)).trimEnd()}…`;
    }
  }
  return lines;
}

/**
 * @param {import('./decision.js').Decision} decision
 * @returns {readonly string[]} problems that make a plate unrenderable
 */
export function validateForPlate(decision) {
  const problems = [];
  if (!decision || typeof decision !== 'object') return ['decision is missing'];
  if (decision.schemaVersion !== 1) problems.push('schemaVersion must be 1');
  if (!decision.title || !String(decision.title).trim()) problems.push('title is required');
  if (!decision.derived || !decision.derived.rulesetVersion) problems.push('derived.rulesetVersion is required');
  for (const id of FACE_IDS) {
    if (!decision.derived?.faceStates?.[id]) problems.push(`faceStates.${id} is missing`);
  }
  const answered = new Set((decision.answers || []).map((a) => a.questionId));
  const required = (decision.questions || []).filter((q) => q.required);
  for (const q of required) {
    if (!answered.has(q.id)) problems.push(`required question ${q.id} is unanswered`);
  }
  for (const finding of decision.derived?.findings || []) {
    if (!finding.title || !finding.body) problems.push(`finding ${finding.code} has no copy`);
  }
  return problems;
}

/**
 * @param {import('./decision.js').Decision} decision
 * @param {DecisionPlateVariant} variant
 * @param {object} copy
 * @param {string} copy.nextTest the exact string deriveNextTest resolved to
 * @param {Record<string, string>} copy.faceLabels
 * @param {Record<string, string>} copy.faceStateLabels
 * @param {string} [copy.metaLabel]
 * @returns {string}
 */
export function decisionMapSvg(decision, variant, copy) {
  const problems = validateForPlate(decision);
  if (problems.length) throw new Error(`decision is not renderable: ${problems.join('; ')}`);
  if (variant !== 'decision-map' && variant !== 'og') throw new Error(`unknown variant: ${variant}`);

  const ink = TOKEN_VALUES['--tm-ink'];
  const muted = TOKEN_VALUES['--tm-ink-muted'];
  const accent = TOKEN_VALUES['--tm-accent'];
  const rule = TOKEN_VALUES['--tm-rule'];
  const out = [];

  out.push(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${PLATE.width}" height="${PLATE.height}" viewBox="0 0 ${PLATE.width} ${PLATE.height}">`
  );
  out.push(`<rect width="${PLATE.width}" height="${PLATE.height}" fill="${TOKEN_VALUES['--tm-paper']}"/>`);

  // meta row: the plate label on the left, the ruleset on the right
  out.push(
    text(PLATE_STRINGS.plateLabel, PLATE.margin, PLATE.metaBaseline, {
      face: 'mono',
      size: 20,
      fill: ink,
      tracking: 2.4
    })
  );
  out.push(
    text(PLATE_STRINGS.ruleset(decision.derived.rulesetVersion), PLATE.safe.maxX, PLATE.metaBaseline, {
      face: 'mono',
      size: 20,
      fill: muted,
      anchor: 'end',
      tracking: 2.4
    })
  );
  out.push(rectRule(PLATE.margin, PLATE.metaBaseline + 26, PLATE.safe.maxX - PLATE.margin, ink, 2));

  // title
  const titleLines = wrapText(decision.title, PLATE.titleMaxWidth, PLATE.titleSize, 'display', 3);
  titleLines.forEach((line, i) => {
    out.push(
      text(line, PLATE.titleX, PLATE.titleY + i * PLATE.titleSize * PLATE.titleLeading, {
        face: 'display',
        size: PLATE.titleSize,
        fill: ink
      })
    );
  });

  // findings, or the exact no-finding fallback. The column keeps its fixed
  // start unless a long title needs the room, which a three-line title does.
  const titleBottom = PLATE.titleY + (titleLines.length - 1) * PLATE.titleSize * PLATE.titleLeading;
  const findings = decision.derived.findings || [];
  let y = Math.max(PLATE.findingsY, Math.round(titleBottom + PLATE.titleSize * 0.62));
  if (!findings.length) {
    out.push(text(PLATE_STRINGS.noFindings, PLATE.findingsX, y, { face: 'body', size: 30, fill: muted }));
  } else {
    const shown = findings.slice(0, variant === 'og' ? 1 : 2);
    for (const finding of shown) {
      out.push(
        text(finding.title, PLATE.findingsX, y, { face: 'display', size: 34, fill: accent })
      );
      y += 42;
      for (const line of wrapText(finding.body, PLATE.findingsWidth, 24, 'body', 3)) {
        out.push(text(line, PLATE.findingsX, y, { face: 'body', size: 24, fill: ink }));
        y += 32;
      }
      y += 22;
    }
  }

  // next test
  out.push(rectRule(PLATE.nextTestX, PLATE.nextTestLabelY - 30, PLATE.findingsWidth, rule, 1));
  out.push(
    text('NEXT TEST', PLATE.nextTestX, PLATE.nextTestLabelY, {
      face: 'mono',
      size: 20,
      fill: accent,
      tracking: 2.4
    })
  );
  wrapText(copy.nextTest, PLATE.findingsWidth, 26, 'body', 2).forEach((line, i) => {
    out.push(text(line, PLATE.nextTestX, PLATE.nextTestBodyY + i * 34, { face: 'body', size: 26, fill: ink }));
  });

  // the crystal, the same component the page renders
  const size = PLATE.crystalHeight;
  const cx = PLATE.crystalX + (PLATE.crystalWidth - size) / 2;
  out.push(`<g transform="translate(${cx} ${PLATE.crystalY})">`);
  out.push(
    crystalSvgMarkup({
      context: 'og',
      states: decision.derived.faceStates,
      idPrefix: `plate-${variant}`,
      // the legend below names every face, so the plate crystal carries no labels
      showLabels: false,
      decorative: true,
      standalone: true,
      size
    })
  );
  out.push('</g>');

  // face legend: every face, its state, in fixed order
  FACE_IDS.forEach((id, i) => {
    const state = decision.derived.faceStates[id];
    const lineY = PLATE.legendY + i * 30;
    out.push(text(copy.faceLabels[id], PLATE.legendX, lineY, { face: 'mono', size: 18, fill: ink, tracking: 1.6 }));
    out.push(
      text(copy.faceStateLabels[state], PLATE.safe.maxX, lineY, {
        face: 'mono',
        size: 18,
        fill: state === 'contradicted' ? accent : muted,
        anchor: 'end',
        tracking: 1.6
      })
    );
  });

  // footer
  out.push(rectRule(PLATE.margin, PLATE.footerRuleY, PLATE.safe.maxX - PLATE.margin, ink, 2));
  out.push(text(PLATE_STRINGS.footer, PLATE.margin, PLATE.footerTextY, { face: 'mono', size: 20, fill: muted, tracking: 2.4 }));
  if (copy.metaLabel) {
    out.push(
      text(copy.metaLabel, PLATE.safe.maxX, PLATE.footerTextY, {
        face: 'mono',
        size: 20,
        fill: muted,
        anchor: 'end',
        tracking: 2.4
      })
    );
  }

  out.push('</svg>');
  return out.join('');
}

/**
 * @param {string} value
 * @param {number} x
 * @param {number} y
 * @param {{face: 'display'|'body'|'mono', size: number, fill: string, anchor?: string, tracking?: number}} options
 */
function text(value, x, y, { face, size, fill, anchor, tracking }) {
  const attrs = [
    `x="${x}"`,
    `y="${y}"`,
    `font-family="${PLATE_FONTS[face]}"`,
    `font-size="${size}"`,
    `fill="${fill}"`
  ];
  if (anchor) attrs.push(`text-anchor="${anchor}"`);
  if (tracking) attrs.push(`letter-spacing="${tracking}"`);
  return `<text ${attrs.join(' ')}>${esc(value)}</text>`;
}

function rectRule(x, y, width, fill, height) {
  return `<rect x="${x}" y="${y}" width="${width}" height="${height}" fill="${fill}"/>`;
}
