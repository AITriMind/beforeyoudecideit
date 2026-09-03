/**
 * Writes the Decision Crystals into index.html between their markers.
 *
 * The site ships no bundler, so the crystals are rendered at build time rather
 * than on load: the page always contains the final SVG, indexable and correct
 * without JavaScript, and the browser module only updates it when a real
 * Decision changes state.
 *
 * Run: node scripts/render-crystal.mjs [--check]
 * --check exits non-zero when the file is out of date instead of writing.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { FACE_IDS } from '../assets/domain/decision.js';
import { crystalSvgMarkup } from '../assets/domain/crystal.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const target = join(root, 'index.html');

const untested = Object.fromEntries(FACE_IDS.map((id) => [id, 'untested']));

/** Each block this script owns: its markers, its states and its indent. */
const BLOCKS = [
  {
    name: 'method',
    context: 'method',
    // the method section shows the object, not a live decision: every state
    // class is present beside the copy that explains it
    states: {
      market: 'tested',
      money: 'untested',
      team: 'unresolved',
      timing: 'committed',
      implementation: 'contradicted',
      'personal-cost': 'untested'
    },
    title: 'The Decision Crystal: six faces',
    indent: '          '
  },
  {
    name: 'hero',
    context: 'hero',
    // a demonstration state, not a decision: one face tested, one in play, the
    // rest still blank. It is never persisted and never reaches analytics.
    states: {
      market: 'tested',
      money: 'untested',
      team: 'untested',
      timing: 'unresolved',
      implementation: 'untested',
      'personal-cost': 'untested'
    },
    decorative: true,
    indent: '          '
  },
  {
    name: 'wizard',
    context: 'wizard',
    // the check starts having tested nothing
    states: untested,
    title: 'Your decision crystal: six faces, updated as you answer',
    indent: '          '
  }
];

const LABEL_KEYS = Object.fromEntries(
  FACE_IDS.map((id) => [
    id,
    `crystal.face${id.replace(/(^|-)([a-z])/g, (_, __, c) => c.toUpperCase())}`
  ])
);

const original = readFileSync(target, 'utf8');
let html = original;
let written = 0;

for (const block of BLOCKS) {
  const start = `<!-- crystal:${block.name}:start -->`;
  const end = `<!-- crystal:${block.name}:end -->`;
  const from = html.indexOf(start);
  const to = html.indexOf(end);
  if (from === -1 || to === -1) {
    console.error(`markers for ${block.name} not found in ${target}`);
    process.exit(1);
  }
  const markup = crystalSvgMarkup({
    context: block.context,
    states: block.states,
    title: block.title,
    decorative: Boolean(block.decorative),
    labelI18nKeys: LABEL_KEYS
  });
  html = html.slice(0, from + start.length) + '\n' + block.indent + markup + '\n' + block.indent + html.slice(to);
  written += markup.length;
}

if (process.argv.includes('--check')) {
  if (html !== original) {
    console.error('index.html crystals are out of date: run node scripts/render-crystal.mjs');
    process.exit(1);
  }
  console.log('crystal markup is current');
} else {
  writeFileSync(target, html);
  console.log(`wrote ${written} bytes of crystal markup into index.html`);
}
