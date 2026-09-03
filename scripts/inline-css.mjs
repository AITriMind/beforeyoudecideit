/**
 * Inlines the stylesheet into the homepage.
 *
 * The homepage's first paint waited on three sequential round trips: the
 * document, then the stylesheet it names, then paint. On a simulated mobile
 * connection that is most of the budget. Inlining removes one of them.
 *
 * Only `index.html` is treated this way. The generated pages keep the external
 * file, so a reader who arrives there second gets it from cache.
 *
 * Run: node scripts/inline-css.mjs [--check]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const target = join(root, 'index.html');
const START = '<!-- css:start -->';
const END = '<!-- css:end -->';

/** Whitespace and comments only; nothing that changes a value. */
function squeeze(css) {
  return css
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\s*\n\s*/g, '\n')
    .replace(/\n{2,}/g, '\n')
    .replace(/\s*([{};:,>])\s*/g, '$1')
    .replace(/;}/g, '}')
    .trim();
}

/**
 * A url() in the stylesheet resolves against the stylesheet. Inlined into the
 * document it would resolve against the document instead, so every relative
 * reference is rebased onto `assets/` on the way in.
 */
function rebase(css) {
  // a quoted or bare url(): keep the quote style, prefix the path
  return css.replace(
    /url\(('|"|)(?!data:|https?:|\/|assets\/)([^'")]+)\1\)/g,
    (whole, quote, path) => `url(${quote}assets/${path}${quote})`
  );
}
const css = rebase(squeeze(readFileSync(join(root, 'assets', 'kraft-offers.css'), 'utf8')));
const html = readFileSync(target, 'utf8');
const from = html.indexOf(START);
const to = html.indexOf(END);
if (from === -1 || to === -1) {
  console.error('css markers not found in index.html');
  process.exit(1);
}

const block = `\n    <style>${css}</style>\n    `;
const next = html.slice(0, from + START.length) + block + html.slice(to);

if (process.argv.includes('--check')) {
  if (next !== html) {
    console.error('index.html styles are out of date: run node scripts/inline-css.mjs');
    process.exit(1);
  }
  console.log('inline styles are current');
} else {
  writeFileSync(target, next);
  console.log(`inlined ${(css.length / 1024).toFixed(1)}KB of CSS into index.html`);
}
