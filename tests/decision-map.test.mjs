/**
 * TM-04 — the Decision Map plate: determinism, the fixed layout, the render
 * states, and the rule that no plate is built from an ad-hoc object.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { FACE_IDS } from '../assets/domain/decision.js';
import { TOKEN_VALUES } from '../assets/domain/crystal.js';
import { decisionFrom, derive } from '../assets/domain/derive.js';
import { PLATE, PLATE_STRINGS, decisionMapSvg, validateForPlate, wrapText } from '../assets/domain/decision-map.js';
import { strings } from '../assets/domain/strings.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const CRACKED = [
  'business-yes',
  'type-more-money',
  'why-hurting',
  'stake-money',
  'stake-months',
  'clarity-already-invested',
  'deadline-no'
];
const CLEAN = ['business-yes', 'type-pricing-change', 'why-deadline', 'clarity-fear-excitement', 'deadline-yes'];

const pascal = (id) => id.replace(/(^|-)([a-z])/g, (_, __, c) => c.toUpperCase());
const lookup = (source, path) => path.split('.').reduce((node, key) => node?.[key], source);

function copyFor(optionIds, lang = 'en') {
  const dictionary = strings[lang];
  return {
    nextTest: lookup(dictionary, derive(optionIds).nextTestKey),
    faceLabels: Object.fromEntries(FACE_IDS.map((id) => [id, lookup(dictionary, `crystal.face${pascal(id)}`)])),
    faceStateLabels: Object.fromEntries(
      ['untested', 'tested', 'unresolved', 'contradicted', 'committed'].map((s) => [s, lookup(dictionary, `faces.${s}`)])
    )
  };
}

const build = (optionIds, lang = 'en') =>
  decisionFrom(optionIds, { id: 'fixture', title: 'Put more money into the existing product', copy: strings[lang] });

const sha = (value) => createHash('sha256').update(value).digest('hex');

/* ---------- determinism and dimensions ---------- */

test('the same decision renders byte-identical SVG every time', () => {
  const decision = build(CRACKED);
  const copy = copyFor(CRACKED);
  assert.equal(sha(decisionMapSvg(decision, 'decision-map', copy)), sha(decisionMapSvg(decision, 'decision-map', copy)));
});

test('the plate is 1600 by 900', () => {
  const svg = decisionMapSvg(build(CRACKED), 'decision-map', copyFor(CRACKED));
  assert.match(svg, /width="1600" height="900"/);
  assert.match(svg, /viewBox="0 0 1600 900"/);
  assert.equal(PLATE.width, 1600);
  assert.equal(PLATE.height, 900);
});

test('nothing is placed outside the safe area', () => {
  const svg = decisionMapSvg(build(CRACKED), 'decision-map', copyFor(CRACKED));
  const xs = [...svg.matchAll(/<text [^>]*x="(\d+(?:\.\d+)?)"/g)].map((m) => Number(m[1]));
  const ys = [...svg.matchAll(/<text [^>]*y="(\d+(?:\.\d+)?)"/g)].map((m) => Number(m[1]));
  assert.ok(xs.length > 0 && ys.length > 0);
  for (const x of xs) assert.ok(x >= PLATE.safe.minX && x <= PLATE.safe.maxX, `x ${x} outside safe area`);
  for (const y of ys) assert.ok(y >= PLATE.safe.minY && y <= PLATE.safe.maxY, `y ${y} outside safe area`);
});

/* ---------- content ---------- */

test('the plate carries the same six face states as the decision', () => {
  const decision = build(CRACKED);
  const svg = decisionMapSvg(decision, 'decision-map', copyFor(CRACKED));
  for (const id of FACE_IDS) {
    assert.match(svg, new RegExp(`data-face-id="${id}" data-face-state="${decision.derived.faceStates[id]}"`));
  }
});

test('the plate prints the exact string deriveNextTest resolved to', () => {
  const copy = copyFor(CRACKED);
  const svg = decisionMapSvg(build(CRACKED), 'decision-map', copy);
  const printed = [...svg.matchAll(/<text [^>]*>([^<]*)<\/text>/g)].map((m) => m[1]).join(' ');
  assert.ok(printed.includes(copy.nextTest.split(' ').slice(0, 6).join(' ')), 'next test is not on the plate');
});

test('a decision with no contradiction prints the exact fallback and invents no risk', () => {
  const svg = decisionMapSvg(build(CLEAN), 'decision-map', copyFor(CLEAN));
  assert.ok(svg.includes(PLATE_STRINGS.noFindings));
  assert.equal(build(CLEAN).derived.findings.length, 0);
});

test('the og variant shows one finding, the map may show two', () => {
  const many = ['business-yes', 'type-pivot', 'why-long-time', 'stake-money', 'stake-months', 'clarity-stopped-checking', 'deadline-no'];
  const decision = build(many);
  assert.ok(decision.derived.findings.length >= 2, 'fixture should produce two findings');
  const og = decisionMapSvg(decision, 'og', copyFor(many));
  const map = decisionMapSvg(decision, 'decision-map', copyFor(many));
  const count = (svg) => decision.derived.findings.filter((f) => svg.includes(f.title)).length;
  assert.equal(count(og), 1);
  assert.equal(count(map), 2);
});

test('both variants render the same crystal component', () => {
  const decision = build(CRACKED);
  const og = decisionMapSvg(decision, 'og', copyFor(CRACKED));
  const map = decisionMapSvg(decision, 'decision-map', copyFor(CRACKED));
  const faces = (svg) => [...svg.matchAll(/data-face-id="([^"]+)" data-face-state="([^"]+)"/g)].map((m) => m.join());
  assert.deepEqual(faces(og), faces(map));
  assert.match(og, /data-crystal-context="og"/);
  assert.match(map, /data-crystal-context="og"/);
});

test('the plate renders in Russian from the same schema', () => {
  const decision = build(CRACKED, 'ru');
  const svg = decisionMapSvg(decision, 'decision-map', copyFor(CRACKED, 'ru'));
  assert.ok(svg.includes('Деньги'), 'russian face label missing');
  assert.ok(/[А-Яа-я]/.test(decision.derived.findings[0].title));
});

/* ---------- the invalid state ---------- */

test('an incomplete or invalid decision is refused, not half-drawn', () => {
  const decision = build(CRACKED);
  assert.deepEqual(validateForPlate(decision), []);
  assert.throws(() => decisionMapSvg({ ...decision, title: '' }, 'decision-map', copyFor(CRACKED)), /not renderable/);
  assert.throws(() => decisionMapSvg({ ...decision, schemaVersion: 2 }, 'decision-map', copyFor(CRACKED)), /not renderable/);
  assert.throws(() => decisionMapSvg({ ...decision, answers: [] }, 'decision-map', copyFor(CRACKED)), /unanswered/);
  const noCopy = { ...decision, derived: { ...decision.derived, findings: [{ code: 'X', faceId: 'money', priority: 1, title: '', body: '' }] } };
  assert.throws(() => decisionMapSvg(noCopy, 'decision-map', copyFor(CRACKED)), /has no copy/);
  assert.throws(() => decisionMapSvg(decision, 'poster', copyFor(CRACKED)), /unknown variant/);
});

/* ---------- no CSS variables survive into a standalone plate ---------- */

test('a standalone plate resolves every token to a literal', () => {
  const svg = decisionMapSvg(build(CRACKED), 'decision-map', copyFor(CRACKED));
  assert.doesNotMatch(svg, /var\(--/);
  assert.ok(svg.includes(TOKEN_VALUES['--tm-paper']));
  assert.ok(svg.includes(TOKEN_VALUES['--tm-accent']));
});

test('font stacks are quoted so they survive an SVG attribute', () => {
  const svg = decisionMapSvg(build(CRACKED), 'decision-map', copyFor(CRACKED));
  assert.doesNotMatch(svg, /font-family=""/);
  for (const m of svg.matchAll(/font-family="([^"]*)"/g)) assert.doesNotMatch(m[1], /"/);
});

/* ---------- wrapping ---------- */

test('wrapping is deterministic and respects its line cap', () => {
  const long = 'one two three four five six seven eight nine ten eleven twelve thirteen fourteen';
  assert.deepEqual(wrapText(long, 300, 24, 'body', 2), wrapText(long, 300, 24, 'body', 2));
  assert.equal(wrapText(long, 300, 24, 'body', 2).length, 2);
  assert.ok(wrapText(long, 300, 24, 'body', 2)[1].endsWith('…'), 'truncation is marked');
  assert.equal(wrapText('', 300, 24, 'body').length, 0);
});

/* ---------- the browser never sees the rasterizer ---------- */

test('no file the browser loads imports sharp', () => {
  const browserFiles = ['assets/kraft-offers.js', 'assets/cover.js', 'assets/press.js', 'assets/check.js'];
  for (const entry of readdirSync(join(root, 'assets', 'domain'))) browserFiles.push(`assets/domain/${entry}`);
  for (const file of browserFiles) {
    const source = readFileSync(join(root, file), 'utf8');
    assert.doesNotMatch(source, /['"]sharp['"]/, `${file} references sharp`);
    assert.doesNotMatch(source, /require\(|node:fs|node:path/, `${file} uses a Node-only API`);
  }
});

test('sharp is a build dependency, pinned exact, and not a runtime one', () => {
  const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
  assert.equal(pkg.devDependencies.sharp, '0.35.4');
  assert.equal(pkg.dependencies, undefined);
});

/* ---------- the tokens have not drifted from the stylesheet ---------- */

test('token literals match the stylesheet', () => {
  const css = readFileSync(join(root, 'assets', 'kraft-offers.css'), 'utf8');
  for (const [name, value] of Object.entries(TOKEN_VALUES)) {
    assert.match(css, new RegExp(`${name}:\\s*${value};`), `${name} drifted from the stylesheet`);
  }
});
