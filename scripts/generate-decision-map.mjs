/**
 * TM-04 — generate a Decision Map plate.
 *
 * Renders the SVG from a Decision, then rasterizes it to a 1600x900 PNG. The
 * SVG half is pure and runs anywhere; `sharp` is required only for the raster
 * and is a build dependency, never shipped to a browser.
 *
 * Run:
 *   node scripts/generate-decision-map.mjs --fixture <name> [--lang en|ru]
 *       [--variant decision-map|og] [--out-dir public/generated/...] [--svg-only]
 *
 * Exits non-zero on an invalid or incomplete Decision, and writes nothing.
 */
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { FACE_IDS } from '../assets/domain/decision.js';
import { decisionFrom, derive } from '../assets/domain/derive.js';
import { decisionMapSvg } from '../assets/domain/decision-map.js';
import { strings } from '../assets/domain/strings.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

/** Named answer vectors, so a plate is always reproducible from a name. */
export const FIXTURES = {
  'sunk-cost': {
    title: 'Put more money into the existing product',
    optionIds: [
      'business-yes',
      'type-more-money',
      'why-hurting',
      'stake-money',
      'stake-months',
      'clarity-already-invested',
      'deadline-no'
    ]
  },
  'price-change': {
    title: "Raise prices for the studio's core service package",
    optionIds: [
      'business-yes',
      'type-pricing-change',
      'why-deadline',
      'stake-market',
      'clarity-fear-excitement',
      'deadline-yes'
    ]
  },
  'partner-split': {
    title: 'Change the partner arrangement before the next quarter',
    optionIds: [
      'business-yes',
      'type-partner-change',
      'why-push',
      'stake-partner',
      'stake-team',
      'clarity-partner-differs',
      'deadline-no'
    ]
  }
};

const args = new Map();
for (let i = 2; i < process.argv.length; i += 1) {
  const arg = process.argv[i];
  if (!arg.startsWith('--')) continue;
  const next = process.argv[i + 1];
  if (!next || next.startsWith('--')) args.set(arg.slice(2), true);
  else {
    args.set(arg.slice(2), next);
    i += 1;
  }
}

const fixtureName = args.get('fixture') || 'price-change';
const lang = args.get('lang') === 'ru' ? 'ru' : 'en';
const variant = args.get('variant') === 'og' ? 'og' : 'decision-map';
const svgOnly = args.has('svg-only');
const outDir = join(root, String(args.get('out-dir') || `public/generated/${variant === 'og' ? 'og' : 'decision-maps'}`));

const fixture = FIXTURES[fixtureName];
if (!fixture) {
  console.error(`unknown fixture: ${fixtureName}. Known: ${Object.keys(FIXTURES).join(', ')}`);
  process.exit(2);
}

/** Resolve the dictionary keys the plate needs into the words it prints. */
export function plateCopy(optionIds, language) {
  const dictionary = strings[language];
  const { nextTestKey } = derive(optionIds);
  return {
    nextTest: lookup(dictionary, nextTestKey),
    faceLabels: Object.fromEntries(
      FACE_IDS.map((id) => [id, lookup(dictionary, `crystal.face${pascal(id)}`)])
    ),
    faceStateLabels: Object.fromEntries(
      ['untested', 'tested', 'unresolved', 'contradicted', 'committed'].map((state) => [
        state,
        lookup(dictionary, `faces.${state}`)
      ])
    )
  };
}

const copy = plateCopy(fixture.optionIds, lang);
let decision;
let svg;
try {
  decision = decisionFrom(fixture.optionIds, {
    id: `${fixtureName}-${lang}`,
    slug: fixtureName,
    title: fixture.title,
    copy: strings[lang]
  });
  svg = decisionMapSvg(decision, variant, copy);
} catch (error) {
  console.error(`cannot render ${fixtureName}: ${error.message}`);
  process.exit(1);
}

mkdirSync(outDir, { recursive: true });
const base = `${fixture.slug || fixtureName}-${lang}`;
const svgPath = join(outDir, `${base}.svg`);
writeFileSync(svgPath, svg);
console.log(`svg  ${svgPath} (${svg.length} bytes, sha ${sha(svg).slice(0, 12)})`);

if (!svgOnly) {
  let sharp;
  try {
    sharp = (await import('sharp')).default;
  } catch {
    console.error('sharp is not installed. Run `npm ci` first, or pass --svg-only.');
    process.exit(3);
  }
  const png = await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toBuffer();
  const meta = await sharp(png).metadata();
  if (meta.width !== 1600 || meta.height !== 900) {
    console.error(`expected 1600x900, produced ${meta.width}x${meta.height}`);
    process.exit(1);
  }
  const pngPath = join(outDir, `${base}.png`);
  writeFileSync(pngPath, png);
  console.log(`png  ${pngPath} (${png.length} bytes, sha ${sha(png).slice(0, 12)})`);
}

function sha(value) {
  return createHash('sha256').update(value).digest('hex');
}

function pascal(id) {
  return id.replace(/(^|-)([a-z])/g, (_, __, c) => c.toUpperCase());
}

function lookup(source, path) {
  const value = path.split('.').reduce((node, key) => (node == null ? node : node[key]), source);
  if (typeof value !== 'string') throw new Error(`dictionary key not found: ${path}`);
  return value;
}
