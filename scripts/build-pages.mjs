/**
 * TM-08 — build the publishing layer.
 *
 * Emits `/decisions/`, one page per published case, `/research/`, and a sitemap
 * that lists published pages and nothing else. Every page is static HTML on the
 * same stylesheet as the homepage; there is no bundler and no client JS on an
 * article body.
 *
 * Run: node scripts/build-pages.mjs [--check]
 */
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { FACE_IDS } from '../assets/domain/decision.js';
import { crystalSvgMarkup } from '../assets/domain/crystal.js';
import { decisionMapSvg } from '../assets/domain/decision-map.js';
import {
  caseDescription,
  caseTitle,
  caseUrl,
  indexIsPublishable,
  isPublishable,
  sitemapSlugs,
  validateCase
} from '../assets/domain/decision-case.js';
import { CASES } from '../content/cases.js';
import { strings } from '../assets/domain/strings.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const SITE = 'https://beforeyoudecideit.com';
const check = process.argv.includes('--check');
const en = strings.en;
const lookup = (path) => path.split('.').reduce((node, key) => node?.[key], en);
const pascal = (id) => id.replace(/(^|-)([a-z])/g, (_, __, c) => c.toUpperCase());

const esc = (value) =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const written = [];

function emit(relativePath, contents) {
  const target = join(root, relativePath);
  if (check) {
    const current = existsSync(target) ? readFileSync(target, 'utf8') : null;
    if (current !== contents) {
      console.error(`${relativePath} is out of date: run node scripts/build-pages.mjs`);
      process.exitCode = 1;
    }
    return;
  }
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, contents);
  written.push(relativePath);
}

/* ---------- the shared shell ---------- */

function page({ title, description, canonical, ogImage, noindex, body, depth }) {
  const up = '../'.repeat(depth);
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${esc(title)}</title>
    <meta name="description" content="${esc(description)}">
    <link rel="canonical" href="${canonical}">
    ${noindex ? '<meta name="robots" content="noindex, nofollow">' : '<meta name="robots" content="index, follow, max-image-preview:large">'}
    <meta property="og:type" content="article">
    <meta property="og:url" content="${canonical}">
    <meta property="og:title" content="${esc(title)}">
    <meta property="og:description" content="${esc(description)}">
    <meta property="og:image" content="${ogImage}">
    <meta property="og:image:width" content="1600">
    <meta property="og:image:height" content="900">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:image" content="${ogImage}">
    <link rel="icon" href="${up}assets/favicon.svg" type="image/svg+xml">
    <link rel="stylesheet" href="${up}assets/kraft-offers.css?v=25">
  </head>
  <body class="dst-page">
    <header class="site-header">
      <a class="wordmark" href="${up}index.html">BEFORE YOU DECIDE</a>
      <p class="running-head"><span class="idx">07</span><span>Decisions</span></p>
      <nav class="top-nav" aria-label="Navigation">
        <a href="${up}index.html#test">The test</a>
        <a href="${up}decisions/">Decisions</a>
        <a href="${up}research/">Research</a>
        <a href="${up}index.html#check">Decision Check</a>
      </nav>
    </header>
    <main>
${body}
    </main>
    <footer class="site-footer">
      <p class="social-links">
        <a href="https://www.instagram.com/alesianezh/" target="_blank" rel="noopener">Instagram</a>
        <a href="https://www.linkedin.com/in/alesia-yuzhakov/" target="_blank" rel="noopener">LinkedIn</a>
      </p>
      <p>Business consulting and decision testing. Not medical, clinical, legal, tax, or investment advice.</p>
    </footer>
  </body>
</html>
`;
}

/* ---------- one case ---------- */

function facesList(decision) {
  const rows = FACE_IDS.map((id) => {
    const state = decision.derived.faceStates[id];
    return `        <li class="result-face" data-face-id="${id}" data-face-state="${state}"><span>${esc(lookup(`crystal.face${pascal(id)}`))}</span><span class="result-face__state">${esc(lookup(`faces.${state}`))}</span></li>`;
  }).join('\n');
  return `      <ul class="result-faces">\n${rows}\n      </ul>`;
}

function findingsBlock(decision) {
  const findings = decision.derived.findings;
  if (!findings.length) {
    return `      <p class="result-finding__none">${esc(en.result.noFindings)}</p>`;
  }
  return findings
    .map(
      (finding) => `      <div class="result-finding" data-finding-code="${finding.code}">
        <h3>${esc(finding.title)}</h3>
        <p>${esc(finding.body)}</p>
      </div>`
    )
    .join('\n');
}

/**
 * @param {object} content
 * @param {number} depth how many directories deep the page sits, so a relative
 *   asset path resolves whether the site is served from a domain root or a
 *   project sub-path
 */
function evidenceBlock(content, depth) {
  const up = '../'.repeat(depth);
  if (!content.evidence.length) {
    return `      <p class="plate-caption">${esc(content.confidentialityNote)}</p>`;
  }
  return content.evidence
    .map(
      (item) => `      <figure class="plate-figure" data-plate-role="evidence" data-plate-id="${item.plateId}">
        <p class="plate-head"><span class="idx" aria-hidden="true">${item.plateId}</span><span class="plate-role">Evidence</span><span class="plate-title">${esc(item.title)}</span></p>
        ${item.assetUrl ? `<span class="plate-frame"><img src="${up}${item.assetUrl.replace(/^\//, '')}" alt="${esc(item.title)}" width="1600" height="900" loading="lazy"></span>` : ''}
        <figcaption class="plate-caption"><span>${esc(item.caption)}</span>${item.sourceLabel ? `<span class="plate-source">${esc(item.sourceLabel)}</span>` : ''}</figcaption>
      </figure>`
    )
    .join('\n');
}

function casePage(content) {
  const { decision } = content;
  const crystal = crystalSvgMarkup({
    context: 'result',
    states: decision.derived.faceStates,
    idPrefix: `case-${decision.slug}`,
    title: `${decision.title}: six faces`,
    labels: Object.fromEntries(FACE_IDS.map((id) => [id, lookup(`crystal.face${pascal(id)}`)]))
  });
  const body = `      <article class="section case-article">
        <p class="kicker"><span class="idx" aria-hidden="true">${content.kind === 'example' ? 'EX' : 'CASE'}</span><span>${esc(decision.category)}</span></p>
        <h1>${esc(decision.title)}</h1>
        <p class="lead">${esc(content.dek)}</p>
        ${content.kind === 'example' ? '<p class="case-note">A worked example, not a client story. The faces and the finding below are produced by the same rules the Decision Check runs.</p>' : ''}

        <h2>The situation</h2>
        <p>${esc(content.situation)}</p>

        <figure class="crystal-figure plate-figure" data-plate-role="test" data-plate-id="PL.01">
          <p class="plate-head"><span class="idx" aria-hidden="true">PL.01</span><span class="plate-role">Test</span><span class="plate-title">${esc(decision.title)}: six faces</span></p>
          ${crystal}
          <figcaption class="plate-caption"><span>${esc(lookup('plate.crystalCaption'))}</span></figcaption>
        </figure>

        <h2>What the six faces show</h2>
${facesList(decision)}

        <h2>What does not hold</h2>
${findingsBlock(decision)}

        <div class="result-next-test">
          <p class="kicker"><span>Next test</span></p>
          <p class="result-next-test__body">${esc(content.nextTest)}</p>
        </div>

        <h2>Evidence</h2>
${evidenceBlock(content, 2)}
${content.followUp ? `\n        <h2>What the check could not reach</h2>\n        <p>${esc(content.followUp)}</p>` : ''}

        <p class="result-actions">
          <a class="primary-link" href="../../index.html#check">Take the 3-minute Decision Check</a>
        </p>
      </article>`;
  return page({
    title: caseTitle(content),
    description: caseDescription(content),
    canonical: `${SITE}${caseUrl(decision.slug)}`,
    ogImage: `${SITE}/public/generated/og/${decision.slug}.png`,
    noindex: !isPublishable(content),
    body,
    depth: 2
  });
}

/* ---------- the index of cases ---------- */

function decisionsIndex(published) {
  const cards = published
    .map(
      (content) => `        <li class="case-card">
          <p class="kicker"><span class="idx" aria-hidden="true">${content.kind === 'example' ? 'EX' : 'CASE'}</span><span>${esc(content.decision.category)}</span></p>
          <h2><a href="${esc(content.decision.slug)}/">${esc(content.decision.title)}</a></h2>
          <p>${esc(content.dek)}</p>
        </li>`
    )
    .join('\n');
  const body = `      <section class="section">
        <p class="kicker"><span class="idx" aria-hidden="true">07</span><span>Decisions</span></p>
        <h1>Decisions, tested</h1>
        <p class="lead">Each entry is one decision put under pressure, with the six faces it left in and the one test that came next. Worked examples are labelled; client cases appear only with consent, anonymized.</p>
        <ul class="case-list">
${cards}
        </ul>
      </section>`;
  return page({
    title: 'Decisions, tested | TriMind',
    description:
      'One decision per entry, put under pressure: the six faces it left in, what did not hold, and the single test that came next. Worked examples are labelled as such.',
    canonical: `${SITE}/decisions/`,
    ogImage: `${SITE}/assets/before-you-decide-og.jpg`,
    noindex: published.length === 0,
    body,
    depth: 1
  });
}

/* ---------- research ---------- */

function researchPage(publishableIndex) {
  const body = `      <section class="section">
        <p class="kicker"><span class="idx" aria-hidden="true">08</span><span>Research</span></p>
        <h1>The Decision Index</h1>
        <p class="lead">What people are actually deciding, and which face breaks most often. Built only from checks whose owners consented to aggregate use, anonymized, with the ruleset version recorded against every record.</p>

        <h2>Method</h2>
        <p>Every completed check derives six face states and, where the answers contradict each other, one or more findings. Those derivations are versioned: a record carries the ruleset that produced it, so a later change to the rules cannot silently rewrite history.</p>
        <p>Aggregation groups only by category, stakes, face state, finding code and recorded outcome. Email domains, decision titles, request metadata and names are never dimensions.</p>

        <h2>What is published</h2>
        ${
          publishableIndex
            ? '<p>Segment figures are published below.</p>'
            : '<p>Nothing quantitative yet. A segment is published only once it holds at least 50 consented records; until then no figure appears here, and no placeholder stands in for one. This page describes the method and nothing more.</p>'
        }
      </section>`;
  return page({
    title: 'The Decision Index | TriMind',
    description:
      'The method behind the Decision Index: how face states and findings are derived, what may be aggregated, and the threshold below which no figure is published at all.',
    canonical: `${SITE}/research/`,
    ogImage: `${SITE}/assets/before-you-decide-og.jpg`,
    noindex: !publishableIndex,
    body,
    depth: 1
  });
}

/* ---------- sitemap ---------- */

function sitemap(published) {
  const urls = [`${SITE}/`, `${SITE}/decisions/`, ...published.map((c) => `${SITE}${caseUrl(c.decision.slug)}`)];
  const entries = urls.map((loc) => `  <url>\n    <loc>${loc}</loc>\n  </url>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.w3.org/1999/sitemaps/schema/0.9">\n${entries}\n</urlset>\n`;
}

/* ---------- run ---------- */

for (const content of CASES) {
  if (content.status !== 'published') continue;
  const problems = validateCase(content);
  if (problems.length) {
    console.error(`case ${content.decision.slug} is marked published but is not publishable:`);
    for (const problem of problems) console.error(`  - ${problem}`);
    process.exit(1);
  }
}

const published = CASES.filter(isPublishable);

for (const content of CASES) {
  emit(`decisions/${content.decision.slug}/index.html`, casePage(content));
}
emit('decisions/index.html', decisionsIndex(published));
emit('research/index.html', researchPage(indexIsPublishable(CASES.map((c) => c.decision))));
emit('sitemap.xml', sitemap(published));

// one OG plate per published case, from the same renderer the maps use
if (!check) {
  const { default: sharp } = await import('sharp').catch(() => ({ default: null }));
  for (const content of published) {
    const svg = decisionMapSvg(content.decision, 'og', {
      nextTest: content.nextTest,
      faceLabels: Object.fromEntries(FACE_IDS.map((id) => [id, lookup(`crystal.face${pascal(id)}`)])),
      faceStateLabels: Object.fromEntries(
        ['untested', 'tested', 'unresolved', 'contradicted', 'committed'].map((s) => [s, lookup(`faces.${s}`)])
      )
    });
    const dir = join(root, 'public', 'generated', 'og');
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, `${content.decision.slug}.svg`), svg);
    if (sharp) {
      const png = await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toBuffer();
      writeFileSync(join(dir, `${content.decision.slug}.png`), png);
      written.push(`public/generated/og/${content.decision.slug}.png`);
    }
  }
}

if (check) {
  if (!process.exitCode) console.log('pages are current');
} else {
  console.log(`${published.length} published, ${CASES.length - published.length} unpublished`);
  for (const file of written) console.log(`  ${file}`);
}

const listed = sitemapSlugs(CASES);
if (!check) console.log(`sitemap lists: ${listed.join(', ') || '(nothing)'}`);
