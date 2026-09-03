/**
 * TM-07 — the plate system. The claims are about the page, so the page is what
 * the assertions read: every editorial visual carries a role, an id, a title
 * and a caption that exist in the document rather than behind a hover.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { PLATES, PLATE_TREATMENTS, plate } from '../assets/domain/plates.js';
import { strings } from '../assets/domain/strings.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const html = readFileSync(join(root, 'index.html'), 'utf8');
const css = readFileSync(join(root, 'assets', 'kraft-offers.css'), 'utf8');
const live = html.replace(/<!--[\s\S]*?-->/g, '');
const lookup = (source, path) => path.split('.').reduce((node, key) => node?.[key], source);

/* ---------- the registry ---------- */

test('plate ids are unique and well formed', () => {
  const ids = PLATES.map((entry) => entry.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const id of ids) assert.match(id, /^PL\.\d{2}$/);
});

test('every plate declares an approved role and treatment', () => {
  for (const entry of PLATES) {
    assert.ok(['test', 'evidence', 'finding'].includes(entry.role), `${entry.id} role`);
    assert.ok(PLATE_TREATMENTS.includes(entry.treatment), `${entry.id} treatment`);
  }
});

test('every plate has copy in both languages', () => {
  for (const entry of PLATES) {
    for (const lang of ['en', 'ru']) {
      assert.equal(typeof lookup(strings[lang], entry.titleKey), 'string', `${entry.id} title ${lang}`);
      assert.equal(typeof lookup(strings[lang], entry.captionKey), 'string', `${entry.id} caption ${lang}`);
      if (entry.sourceKey) {
        assert.equal(typeof lookup(strings[lang], entry.sourceKey), 'string', `${entry.id} source ${lang}`);
      }
    }
  }
});

/* ---------- the page ---------- */

test('the registry and the markup agree', () => {
  const inPage = [...live.matchAll(/data-plate-id="([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual([...inPage].sort(), PLATES.map((p) => p.id).sort());
  for (const id of inPage) assert.ok(plate(id), `${id} is in the page but not the registry`);
});

test('every editorial image sits inside a classified plate', () => {
  const blocks = live.split('<figure').slice(1);
  const imagesInPlates = blocks
    .filter((block) => block.includes('data-plate-role='))
    .reduce((count, block) => count + (block.match(/<img /g) || []).length, 0);
  const allImages = (live.match(/<img /g) || []).length;
  assert.equal(imagesInPlates, allImages, 'an image is outside a plate');
  assert.ok(allImages > 0);
});

test('every plate in the page states its id, role, title and caption as text', () => {
  for (const entry of PLATES) {
    const at = live.indexOf(`data-plate-id="${entry.id}"`);
    assert.ok(at > -1, `${entry.id} is not in the page`);
    // read to the end of the figure, not a fixed window: a plate may hold a
    // full inline SVG between its header and its caption
    const from = live.lastIndexOf('<', at);
    const closer = live.startsWith('<article', from) ? '</article>' : '</figure>';
    const block = live.slice(from, live.indexOf(closer, at) + closer.length);
    assert.ok(block.includes(`>${entry.id}<`), `${entry.id} does not print its id`);
    assert.match(block, /class="plate-role"/, `${entry.id} does not name its role`);
    assert.ok(block.includes(`data-i18n="${entry.titleKey}"`), `${entry.id} has no title`);
    assert.ok(block.includes(`data-i18n="${entry.captionKey}"`), `${entry.id} has no caption`);
    if (entry.sourceKey) {
      assert.ok(block.includes(`data-i18n="${entry.sourceKey}"`), `${entry.id} has no source line`);
    }
  }
});

test('no caption depends on hover or focus to be read', () => {
  assert.doesNotMatch(css, /\.plate-caption[^{]*:hover/);
  assert.doesNotMatch(css, /\.plate-caption\s*\{[^}]*display:\s*none/);
  assert.doesNotMatch(live, /title="[^"]*"[^>]*class="plate-caption"/);
});

test('every image declares its intrinsic size', () => {
  for (const tag of live.match(/<img [^>]*>/g) || []) {
    assert.match(tag, /width="\d+"/, tag);
    assert.match(tag, /height="\d+"/, tag);
    assert.match(tag, /alt="[^"]+"/, tag);
  }
});

test('alt text describes what is in the image, not how it looks', () => {
  // `\salt=` so the i18n key in data-i18n-alt is not mistaken for alt text
  const alts = [...live.matchAll(/<img [^>]*\salt="([^"]+)"/g)].map((m) => m[1]);
  assert.ok(alts.length >= 3);
  for (const alt of alts) {
    assert.doesNotMatch(alt, /halftone|duotone|two-tone|photo of|image of|picture of/i, alt);
    assert.ok(alt.split(/\s+/).length >= 4, `alt is too thin to be informative: ${alt}`);
  }
});

test('the decorative cover is hidden from assistive technology', () => {
  const cover = live.slice(live.indexOf('class="cover"'), live.indexOf('</div>', live.indexOf('class="cover"')));
  assert.match(cover, /<canvas aria-hidden="true">/);
});

/* ---------- the constraints ---------- */

test('the accent is never a large background', () => {
  // A solid accent fill is allowed on a rule up to 4px, or on a mark whose box
  // is at most 32px. Anything else — a section, card, plate, panel — is not.
  // The test reads the reason out of the block rather than trusting a name.
  const px = (block, property) => {
    const match = block.match(new RegExp(property + ':\\s*([\\d.]+)(px|rem)'));
    if (!match) return null;
    return Number(match[1]) * (match[2] === 'rem' ? 16 : 1);
  };
  for (const raw of css.split('}')) {
    if (!/background(-color)?:\s*var\(--(tm-)?accent\)/.test(raw)) continue;
    const selector = raw.slice(0, raw.indexOf('{')).trim().replace(/\s+/g, ' ');
    const height = px(raw, 'height');
    const width = px(raw, 'width');
    const isRule = height !== null && height <= 4;
    const isMark = height !== null && width !== null && height <= 32 && width <= 32;
    const isInput = /input/.test(selector);
    assert.ok(isRule || isMark || isInput, `accent fills ${selector} and it is neither a rule nor a mark`);
  }
});

test('no runtime code filters an image', () => {
  // The halftone treatment is baked offline; nothing re-renders a photograph in
  // the browser. `assets/cover.js` is deliberately outside this list: it
  // composes and breaks up the cover sheet on canvas, which is a page
  // transition the owner asked to keep, not an art-direction filter applied to
  // an image. No plate is drawn through it.
  const runtime = ['assets/kraft-offers.js', 'assets/press.js', 'assets/check.js', 'assets/result.js'];
  for (const entry of readdirSync(join(root, 'assets', 'domain'))) runtime.push(`assets/domain/${entry}`);
  for (const file of runtime) {
    const source = readFileSync(join(root, file), 'utf8');
    assert.doesNotMatch(source, /getImageData|putImageData|createImageData|drawImage/, `${file} reads image pixels`);
  }
  assert.doesNotMatch(css, /filter:\s*(?!none)/, 'a CSS filter is doing art direction');
});

test('no above-the-fold raster is heavy', () => {
  for (const name of readdirSync(join(root, 'assets', 'img'))) {
    const bytes = statSync(join(root, 'assets', 'img', name)).size;
    assert.ok(bytes <= 180 * 1024, `${name} is ${Math.round(bytes / 1024)}KB`);
  }
});
