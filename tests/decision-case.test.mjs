/**
 * TM-08 — the publishing layer. The rules that matter are the ones that refuse:
 * an unpublished case never reaches the sitemap, a segment below the threshold
 * never becomes a number, and a case cannot claim a face the rules would not
 * produce.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { FACE_IDS } from '../assets/domain/decision.js';
import { derive } from '../assets/domain/derive.js';
import {
  AGGREGATE_MIN_N,
  DEK_MAX,
  DEK_MIN,
  aggregate,
  aggregateInput,
  caseDescription,
  caseTitle,
  caseUrl,
  indexIsPublishable,
  isPublishable,
  sitemapSlugs,
  validateCase
} from '../assets/domain/decision-case.js';
import { CASES } from '../content/cases.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');

/* ---------- the content ---------- */

test('every case that claims to be published really is publishable', () => {
  for (const content of CASES) {
    if (content.status !== 'published') continue;
    assert.deepEqual(validateCase(content), [], `${content.decision.slug} is not publishable`);
  }
});

test('a case cannot claim a face the rules would not produce', () => {
  for (const content of CASES) {
    const optionIds = content.decision.answers.map((a) => a.optionId);
    const derived = derive(optionIds);
    assert.deepEqual(
      content.decision.derived.faceStates,
      derived.faceStates,
      `${content.decision.slug} face states drifted from the ruleset`
    );
    assert.deepEqual(
      content.decision.derived.findings.map((f) => f.code),
      derived.findings.map((f) => f.code),
      `${content.decision.slug} findings drifted from the ruleset`
    );
  }
});

test('a dek is long enough to be a description and short enough to be one', () => {
  for (const content of CASES) {
    const length = content.dek.trim().length;
    assert.ok(length >= DEK_MIN && length <= DEK_MAX, `${content.decision.slug} dek is ${length}`);
  }
});

test('a worked example says so, and no case invents a client', () => {
  for (const content of CASES) {
    assert.ok(['example', 'case'].includes(content.kind));
    if (content.kind === 'example' && isPublishable(content)) {
      const html = read(`decisions/${content.decision.slug}/index.html`);
      assert.match(html, /worked example, not a client story/i, 'the page does not disclose that it is an example');
    }
  }
});

/* ---------- validation refuses ---------- */

test('a published case without consent flags is refused', () => {
  const good = CASES.find((c) => c.status === 'published');
  const bad = {
    ...good,
    decision: { ...good.decision, publication: { ...good.decision.publication, isPublic: false } }
  };
  assert.ok(validateCase(bad).some((p) => p.includes('must be public')));
});

test('a case with neither evidence nor a confidentiality note is refused', () => {
  const good = CASES.find((c) => c.status === 'published');
  const bare = { ...good, evidence: [], confidentialityNote: '' };
  assert.ok(validateCase(bare).some((p) => p.includes('evidence')));
});

test('a case with no next test, situation or dek is refused', () => {
  const good = CASES.find((c) => c.status === 'published');
  assert.ok(validateCase({ ...good, nextTest: '' }).some((p) => p.includes('next test')));
  assert.ok(validateCase({ ...good, situation: '' }).some((p) => p.includes('situation')));
  assert.ok(validateCase({ ...good, dek: 'too short' }).some((p) => p.includes('dek')));
});

/* ---------- the sitemap ---------- */

test('only published cases reach the sitemap', () => {
  const slugs = sitemapSlugs(CASES);
  const drafts = CASES.filter((c) => c.status !== 'published').map((c) => c.decision.slug);
  assert.ok(drafts.length > 0, 'the fixture set should include something unpublished');
  const xml = read('sitemap.xml');
  for (const slug of slugs) assert.ok(xml.includes(`/decisions/${slug}/`), `${slug} missing from sitemap`);
  for (const slug of drafts) assert.ok(!xml.includes(`/decisions/${slug}/`), `${slug} leaked into the sitemap`);
});

test('an unpublished case page carries noindex; a published one does not', () => {
  for (const content of CASES) {
    const html = read(`decisions/${content.decision.slug}/index.html`);
    if (isPublishable(content)) {
      assert.match(html, /max-image-preview:large/);
      assert.doesNotMatch(html, /content="noindex/);
    } else {
      assert.match(html, /content="noindex/, `${content.decision.slug} should be noindex`);
    }
  }
});

/* ---------- the pages ---------- */

test('a published case page has one h1 equal to the decision title, and its own canonical', () => {
  for (const content of CASES.filter(isPublishable)) {
    const html = read(`decisions/${content.decision.slug}/index.html`);
    const h1s = [...html.matchAll(/<h1[^>]*>([\s\S]*?)<\/h1>/g)].map((m) => m[1].trim());
    assert.equal(h1s.length, 1);
    assert.equal(h1s[0], content.decision.title);
    assert.ok(html.includes(`<title>${caseTitle(content)}</title>`));
    assert.ok(html.includes(`href="https://beforeyoudecideit.com${caseUrl(content.decision.slug)}"`));
    assert.ok(html.includes(`content="${caseDescription(content)}"`));
  }
});

test('the page prints all six face states as text', () => {
  for (const content of CASES.filter(isPublishable)) {
    const html = read(`decisions/${content.decision.slug}/index.html`);
    for (const id of FACE_IDS) {
      assert.match(html, new RegExp(`data-face-id="${id}" data-face-state="${content.decision.derived.faceStates[id]}"`));
    }
  }
});

test('every published case has a generated 1600x900 OG plate', () => {
  for (const content of CASES.filter(isPublishable)) {
    const png = `public/generated/og/${content.decision.slug}.png`;
    assert.ok(existsSync(join(root, png)), `${png} was not generated`);
    const html = read(`decisions/${content.decision.slug}/index.html`);
    assert.ok(html.includes(`/public/generated/og/${content.decision.slug}.png`));
    assert.match(html, /og:image:width" content="1600"/);
    assert.match(html, /og:image:height" content="900"/);
  }
});

test('canonical urls are unique', () => {
  const urls = CASES.map((c) => caseUrl(c.decision.slug));
  assert.equal(new Set(urls).size, urls.length);
});

test('no article body ships client JavaScript', () => {
  for (const content of CASES) {
    const html = read(`decisions/${content.decision.slug}/index.html`);
    assert.doesNotMatch(html, /<script/);
  }
  assert.doesNotMatch(read('decisions/index.html'), /<script/);
  assert.doesNotMatch(read('research/index.html'), /<script/);
});

test('no page is generated from a keyword list', () => {
  const source = read('scripts/build-pages.mjs');
  assert.doesNotMatch(source, /keyword/i);
  // pages come from CASES and nothing else
  assert.match(source, /for \(const content of CASES\)/);
});

/* ---------- the Decision Index ---------- */

const consented = (n, extra = {}) =>
  Array.from({ length: n }, (_, i) => ({
    schemaVersion: 1,
    id: `d${i}`,
    slug: `d${i}`,
    title: 't',
    category: i % 2 ? 'pricing change' : 'pivot',
    stakes: 'high',
    status: 'completed',
    disposition: 'continue-testing',
    questions: [],
    answers: [],
    derived: {
      rulesetVersion: '2026-09-bydi',
      faceStates: Object.fromEntries(FACE_IDS.map((id) => [id, 'untested'])),
      contradictions: [],
      findings: []
    },
    publication: { isPublic: false, anonymized: true, consentForAggregate: true, tags: [] },
    ...extra
  }));

test('records without consent are invisible to research', () => {
  const withConsent = consented(3);
  const without = consented(4, { publication: { isPublic: false, anonymized: true, consentForAggregate: false, tags: [] } });
  assert.equal(aggregateInput([...withConsent, ...without]).length, 3);
});

test('a record that is not anonymized is invisible to research', () => {
  const identified = consented(2, { publication: { isPublic: false, anonymized: false, consentForAggregate: true, tags: [] } });
  assert.equal(aggregateInput(identified).length, 0);
});

test('a segment below the threshold is counted but never publishable', () => {
  const rows = aggregate(consented(10), 'category');
  assert.ok(rows.length > 0);
  for (const row of rows) {
    assert.ok(row.n < AGGREGATE_MIN_N);
    assert.equal(row.publishable, false);
  }
  assert.equal(indexIsPublishable(consented(AGGREGATE_MIN_N - 1)), false);
  assert.equal(indexIsPublishable(consented(AGGREGATE_MIN_N)), true);
});

test('research may not group by an identifying dimension', () => {
  assert.throws(() => aggregate(consented(2), 'email'), /not permitted/);
  assert.throws(() => aggregate(consented(2), 'title'), /not permitted/);
});

test('the research page carries no figure until the threshold is met', () => {
  const html = read('research/index.html');
  assert.match(html, /content="noindex/, 'an empty index page must not be indexed');
  assert.match(html, /at least 50 consented records/);
  assert.doesNotMatch(html.replace(/at least 50 consented records/, ''), /\b\d+%/, 'a percentage is on the page');
});
