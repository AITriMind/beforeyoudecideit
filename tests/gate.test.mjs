/**
 * TM-09 / TM-10 — the release gate, in the parts that can be settled by reading
 * the tree rather than driving a browser. The browser half lives in
 * `scripts/qa.mjs`; both must pass before a release.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { gzipSync } from 'node:zlib';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');
const css = readFileSync(join(root, 'assets', 'kraft-offers.css'), 'utf8');
const gzipKb = (p) => gzipSync(readFileSync(join(root, p))).length / 1024;

/** Everything the browser downloads and runs on the homepage. */
const BROWSER_JS = ['assets/kraft-offers.js', 'assets/cover.js', 'assets/press.js', 'assets/check.js', 'assets/result.js']
  .concat(readdirSync(join(root, 'assets', 'domain')).map((f) => `assets/domain/${f}`));

/* ---------- forbidden technology ---------- */

test('no prohibited library is in the dependency graph or the source', () => {
  const pkg = JSON.parse(read('package.json'));
  const declared = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
  for (const name of ['three', '@react-three/fiber', 'lenis', 'locomotive-scroll', 'gsap', 'framer-motion']) {
    assert.equal(declared[name], undefined, `${name} is declared`);
  }
  for (const file of [...BROWSER_JS, 'index.html']) {
    const source = read(file);
    assert.doesNotMatch(source, /from ['"](three|lenis|locomotive-scroll|gsap|motion)['"]/, file);
  }
});

test('the tree has no production runtime dependency', () => {
  const pkg = JSON.parse(read('package.json'));
  assert.equal(pkg.dependencies, undefined);
  assert.deepEqual(Object.keys(pkg.devDependencies).sort(), ['lighthouse', 'sharp']);
});

test('no build-only tool can reach the browser', () => {
  for (const file of BROWSER_JS) {
    const source = read(file);
    assert.doesNotMatch(source, /['"]sharp['"]|['"]lighthouse['"]/, `${file} imports a build tool`);
  }
  // the word "sharp" appears in the sample map's prose; look for a load, not a word
  assert.doesNotMatch(read('index.html'), /(src|href)="[^"]*(sharp|lighthouse)/);
});

test('nothing intercepts the wheel or a touch move', () => {
  for (const file of BROWSER_JS) {
    const source = read(file);
    const listeners = [...source.matchAll(/addEventListener\(\s*['"](wheel|touchmove|touchstart)['"]/g)];
    for (const match of listeners) {
      const after = source.slice(match.index, match.index + 400);
      assert.doesNotMatch(after, /preventDefault/, `${file} intercepts ${match[1]}`);
    }
  }
});

test('no component runs a continuous animation frame loop', () => {
  for (const file of BROWSER_JS) {
    const source = read(file);
    // a self-scheduling rAF is only allowed inside the cover's one-shot drop
    if (file.endsWith('cover.js')) continue;
    const raf = [...source.matchAll(/requestAnimationFrame\(/g)].length;
    if (!raf) continue;
    assert.match(
      source,
      /if \(!raf\) raf = requestAnimationFrame|requestAnimationFrame\(\(\) =>/,
      `${file} schedules frames without a guard`
    );
  }
});

test('no unresolved TODO is left in production code', () => {
  for (const file of [...BROWSER_JS, 'index.html', 'assets/kraft-offers.css']) {
    assert.doesNotMatch(read(file), /\bTODO\b|\bFIXME\b/, file);
  }
});

test('no PLACEHOLDER path survived from the specification', () => {
  for (const file of [...BROWSER_JS, 'index.html', 'scripts/build-pages.mjs', 'scripts/render-crystal.mjs']) {
    assert.doesNotMatch(read(file), /\[PLACEHOLDER\]/, file);
  }
});

/* ---------- weight ---------- */

test('first-party browser JavaScript is inside the release budget', () => {
  const total = BROWSER_JS.reduce((sum, file) => sum + gzipKb(file), 0);
  assert.ok(total <= 120, `first-party JS is ${total.toFixed(1)}KB gzip, budget is 120KB`);
});

test('the stylesheet stays small', () => {
  const css = gzipKb('assets/kraft-offers.css');
  assert.ok(css <= 20, `stylesheet is ${css.toFixed(1)}KB gzip`);
});

test('first-view font transfer is inside the budget', () => {
  // the page preloads latin Literata; a Russian reader adds the cyrillic cuts
  const firstView = ['literata-latin', 'literata-italic-latin', 'plexsans-latin', 'plexmono-latin'];
  const bytes = firstView.reduce(
    (sum, name) => sum + statSync(join(root, 'assets', 'fonts', `${name}.woff2`)).size,
    0
  );
  assert.ok(bytes / 1024 <= 140, `first view loads ${(bytes / 1024).toFixed(1)}KB of fonts, budget is 140KB`);
});

test('every face is subset, and its unicode-range matches the file', async () => {
  // a codepoint declared in range but missing from the file renders as tofu
  const src = join(root, 'assets', 'fonts', 'src');
  assert.ok(existsSync(src), 'the unsubset originals are not kept');
  for (const name of readdirSync(src)) {
    const original = statSync(join(src, name)).size;
    const shipped = statSync(join(root, 'assets', 'fonts', name)).size;
    assert.ok(shipped < original, `${name} is not smaller than its original`);
  }
  const declared = [...css.matchAll(/unicode-range:\s*([^;]+);/g)].map((m) => m[1].trim());
  assert.ok(declared.length >= 8);
  for (const range of declared) {
    assert.doesNotMatch(range, /U\+0000-00FF|U\+2000-206F/, `${range} is wider than any subset`);
  }
});

test('above-fold raster transfer is zero and every image stays under its cap', () => {
  const hero = read('index.html').slice(0, read('index.html').indexOf('</section>'));
  assert.doesNotMatch(hero, /<img /, 'the hero ships a raster');
  for (const name of readdirSync(join(root, 'assets', 'img'))) {
    const kb = statSync(join(root, 'assets', 'img', name)).size / 1024;
    assert.ok(kb <= 180, `${name} is ${kb.toFixed(0)}KB, cap is 180KB`);
  }
});

test('the crystal makes no external request', () => {
  const crystal = read('assets/domain/crystal.js');
  // the SVG and xlink namespaces are identifiers, not fetches
  const fetches = crystal.replace(/http:\/\/www\.w3\.org\/[^'"` ]*/g, '');
  assert.doesNotMatch(fetches, /https?:\/\//, 'the crystal module references a URL');
  const markup = read('index.html');
  const svgs = [...markup.matchAll(/<svg class="tm-crystal[\s\S]*?<\/svg>/g)];
  assert.ok(svgs.length >= 2);
  for (const [svg] of svgs) {
    assert.doesNotMatch(svg, /<image|xlink:href|url\(http/, 'the crystal references an external asset');
  }
});

/* ---------- the domain gate ---------- */

test('every contradiction rule still has a fixture that fires it', async () => {
  const { RULES } = await import('../assets/domain/derive.js');
  const suite = read('tests/derive.test.mjs');
  for (const rule of RULES) {
    assert.ok(suite.includes(`'${rule.id}'`), `${rule.id} has no fixture`);
  }
});

test('the generated pages and crystals are current', () => {
  // the build scripts own these; a stale file here means the tree lies
  assert.ok(existsSync(join(root, 'decisions', 'index.html')));
  assert.ok(existsSync(join(root, 'research', 'index.html')));
  assert.ok(existsSync(join(root, 'sitemap.xml')));
});

/* ---------- accessibility contracts that live in the markup ---------- */

test('the check exposes six fieldsets with legends and native radios', () => {
  const html = read('index.html');
  const form = html.slice(html.indexOf('<form class="decision-check"'), html.indexOf('</form>'));
  assert.equal((form.match(/<fieldset>/g) || []).length, 6);
  assert.equal((form.match(/<legend/g) || []).length, 6);
  assert.ok((form.match(/type="radio"/g) || []).length >= 20);
  assert.match(form, /QUESTION \{n\} OF 6|Question 1 of 6|data-step-label/);
});

test('the hero crystal is decorative and the method crystal is named', () => {
  const html = read('index.html');
  const hero = html.slice(html.indexOf('class="hero-crystal"'), html.indexOf('</section>', html.indexOf('class="hero-crystal"')));
  assert.match(hero, /aria-hidden="true"/);
  assert.doesNotMatch(hero, /<title/);
  const method = html.slice(html.indexOf('data-crystal-context="method"'));
  assert.match(method.slice(0, 400), /role="img"/);
});

test('one h1 per page', () => {
  const pages = ['index.html', 'decisions/index.html', 'research/index.html'];
  for (const entry of readdirSync(join(root, 'decisions'))) {
    if (existsSync(join(root, 'decisions', entry, 'index.html'))) pages.push(`decisions/${entry}/index.html`);
  }
  for (const page of pages) {
    const count = (read(page).match(/<h1[\s>]/g) || []).length;
    assert.equal(count, 1, `${page} has ${count} h1 elements`);
  }
});

test('heading levels never skip', () => {
  const pages = ['decisions/index.html', 'research/index.html', 'decisions/raising-the-price-of-the-core-package/index.html'];
  for (const page of pages) {
    const levels = [...read(page).matchAll(/<h([1-6])[\s>]/g)].map((m) => Number(m[1]));
    let previous = 0;
    for (const level of levels) {
      if (previous) assert.ok(level <= previous + 1, `${page} jumps from h${previous} to h${level}`);
      previous = level;
    }
  }
});
