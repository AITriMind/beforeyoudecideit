/**
 * TM-08 — the publishing layer.
 *
 * A Decision Case is a `Decision` plus the words around it. It is not a second
 * schema and not an article that happens to mention decisions: the six faces,
 * the findings and the next test come from the same derivation the check runs,
 * so a case cannot claim something the rules would not produce.
 *
 * Nothing here fabricates a client story. A case is publishable only when it
 * carries real material and the owner's consent flags say so.
 */

import { FACE_IDS } from './decision.js?v=27';

/** @typedef {'draft'|'review'|'published'|'archived'} CaseStatus */

/**
 * @typedef {object} CaseEvidence
 * @property {string} plateId
 * @property {string} title
 * @property {string} caption
 * @property {string} [assetUrl]
 * @property {string} [sourceLabel]
 */

/**
 * @typedef {object} DecisionCaseContent
 * @property {import('./decision.js').Decision} decision
 * @property {CaseStatus} status
 * @property {string} kind `example` for a worked illustration, `case` for a real one
 * @property {string} dek 140-170 characters; the meta description is derived from it
 * @property {string} situation
 * @property {readonly CaseEvidence[]} evidence
 * @property {string} nextTest
 * @property {string} [followUp]
 * @property {string} [confidentialityNote] stands in when evidence cannot be shown
 */

export const DEK_MIN = 140;
export const DEK_MAX = 170;

/** Below this, a segment is not a number anyone should read as one. */
export const AGGREGATE_MIN_N = 50;

/**
 * Everything a case must carry before it may be published. A draft may be
 * incomplete; a published case may not.
 *
 * @param {DecisionCaseContent} content
 * @returns {readonly string[]} problems; empty means publishable
 */
export function validateCase(content) {
  const problems = [];
  if (!content || typeof content !== 'object') return ['case is missing'];
  const { decision } = content;

  if (!decision) return ['case has no decision'];
  if (!decision.title?.trim()) problems.push('decision title is required');
  if (!decision.category?.trim()) problems.push('category is required');
  if (!decision.slug?.trim()) problems.push('slug is required');
  if (!content.situation?.trim()) problems.push('situation is required');

  const dek = (content.dek || '').trim();
  if (dek.length < DEK_MIN || dek.length > DEK_MAX) {
    problems.push(`dek must be ${DEK_MIN}-${DEK_MAX} characters, is ${dek.length}`);
  }

  for (const id of FACE_IDS) {
    if (!decision.derived?.faceStates?.[id]) problems.push(`faceStates.${id} is missing`);
  }

  if (!content.nextTest?.trim()) problems.push('a next test is required');

  const hasEvidence = (content.evidence || []).length > 0;
  if (!hasEvidence && !content.confidentialityNote?.trim()) {
    problems.push('a case needs evidence, or an explicit note saying why it cannot be shown');
  }
  for (const item of content.evidence || []) {
    if (!item.plateId || !item.title || !item.caption) {
      problems.push(`evidence ${item.plateId || '(unnamed)'} needs a plate id, a title and a caption`);
    }
  }

  if (content.status === 'published') {
    if (decision.publication?.isPublic !== true) problems.push('a published case must be public');
    if (decision.publication?.anonymized !== true) problems.push('a published case must be anonymized');
  }

  return problems;
}

/**
 * @param {DecisionCaseContent} content
 * @returns {boolean}
 */
export function isPublishable(content) {
  return content.status === 'published' && validateCase(content).length === 0;
}

/**
 * The sitemap carries published pages and nothing else. A draft, a review, an
 * archived page or a case that fails validation never appears.
 *
 * @param {readonly DecisionCaseContent[]} cases
 * @returns {readonly string[]} slugs
 */
export function sitemapSlugs(cases) {
  return cases.filter(isPublishable).map((content) => content.decision.slug);
}

/**
 * @param {string} slug
 * @returns {string}
 */
export function caseUrl(slug) {
  return `/decisions/${slug}/`;
}

/**
 * @param {DecisionCaseContent} content
 * @returns {string}
 */
export function caseTitle(content) {
  return `${content.decision.title} | TriMind`;
}

/**
 * The meta description comes from the authored dek, never from the body.
 * @param {DecisionCaseContent} content
 */
export function caseDescription(content) {
  return content.dek.trim();
}

/* ---------- the Decision Index ---------- */

/**
 * Only consented, anonymized, finished records with a known ruleset are
 * aggregated. Everything else is invisible to research.
 *
 * @param {readonly import('./decision.js').Decision[]} decisions
 * @returns {readonly import('./decision.js').Decision[]}
 */
export function aggregateInput(decisions) {
  return decisions.filter(
    (d) =>
      d?.publication?.consentForAggregate === true &&
      d?.publication?.anonymized === true &&
      ['completed', 'published'].includes(d.status) &&
      Boolean(d.derived?.rulesetVersion)
  );
}

/** Dimensions research may group by. Anything else is not offered. */
export const AGGREGATE_DIMENSIONS = Object.freeze(['category', 'stakes', 'faceState', 'findingCode', 'outcome']);

/**
 * Count a dimension across consented records, then withhold every segment too
 * small to be a number. A withheld segment reports its state, never a figure.
 *
 * @param {readonly import('./decision.js').Decision[]} decisions
 * @param {'category'|'stakes'|'faceState'|'findingCode'|'outcome'} dimension
 * @returns {readonly {key: string, n: number, publishable: boolean}[]}
 */
export function aggregate(decisions, dimension) {
  if (!AGGREGATE_DIMENSIONS.includes(dimension)) {
    throw new Error(`dimension not permitted: ${dimension}`);
  }
  const counts = new Map();
  const bump = (key) => counts.set(key, (counts.get(key) || 0) + 1);

  for (const d of aggregateInput(decisions)) {
    if (dimension === 'category') bump(d.category || 'unstated');
    else if (dimension === 'stakes') bump(d.stakes);
    else if (dimension === 'outcome') bump(d.outcome?.result || 'unknown');
    else if (dimension === 'faceState') {
      for (const id of FACE_IDS) bump(`${id}:${d.derived.faceStates[id]}`);
    } else if (dimension === 'findingCode') {
      for (const finding of d.derived.findings || []) bump(finding.code);
    }
  }

  return [...counts.entries()]
    .map(([key, n]) => ({ key, n, publishable: n >= AGGREGATE_MIN_N }))
    .sort((a, b) => b.n - a.n || a.key.localeCompare(b.key));
}

/**
 * Whether the Decision Index may carry any quantitative claim at all.
 * @param {readonly import('./decision.js').Decision[]} decisions
 */
export function indexIsPublishable(decisions) {
  return aggregateInput(decisions).length >= AGGREGATE_MIN_N;
}
