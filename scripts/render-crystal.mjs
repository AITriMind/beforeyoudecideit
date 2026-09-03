/**
 * Writes the Decision Crystal into index.html between its markers.
 *
 * The site ships no bundler, so the crystal is rendered at build time rather
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
const START = '<!-- crystal:method:start -->';
const END = '<!-- crystal:method:end -->';

/**
 * The method section shows the object, not a live decision: a crystal with one
 * face tested, one cracked and one committed, so every state class is present
 * beside the copy that explains it.
 */
const METHOD_STATES = {
  market: 'tested',
  money: 'untested',
  team: 'unresolved',
  timing: 'committed',
  implementation: 'contradicted',
  'personal-cost': 'untested'
};

const LABEL_KEYS = Object.fromEntries(
  FACE_IDS.map((id) => [
    id,
    `crystal.face${id.replace(/(^|-)([a-z])/g, (_, __, c) => c.toUpperCase())}`
  ])
);

const markup = crystalSvgMarkup({
  context: 'method',
  states: METHOD_STATES,
  title: 'The Decision Crystal: six faces',
  labelI18nKeys: LABEL_KEYS
});

const html = readFileSync(target, 'utf8');
const from = html.indexOf(START);
const to = html.indexOf(END);
if (from === -1 || to === -1) {
  console.error(`markers not found in ${target}`);
  process.exit(1);
}

const next = `${html.slice(0, from + START.length)}\n          ${markup}\n          ${html.slice(to)}`;
if (process.argv.includes('--check')) {
  if (next !== html) {
    console.error('index.html crystal is out of date: run node scripts/render-crystal.mjs');
    process.exit(1);
  }
  console.log('crystal markup is current');
} else {
  writeFileSync(target, next);
  console.log(`wrote ${markup.length} bytes of crystal markup into index.html`);
}
