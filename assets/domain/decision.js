/**
 * TM-01 — the canonical Decision model.
 *
 * This is the only domain model on the site. The wizard, the result, the
 * Decision Map and the publishing layer all read and write this shape; none of
 * them may reconstruct a parallel object.
 *
 * The specification states the contract in TypeScript. This repository ships no
 * build step (A-01/A-02 verified false), so the contract is expressed as JSDoc
 * typedefs over plain ES modules: identical shape, no compiler, no dependency.
 *
 * Privacy: email, name, phone, scheduling identifiers, IP-derived values and CRM
 * ids are never fields on a Decision. Contact data lives in a separate lead
 * object (OD-02).
 */

export const SCHEMA_VERSION = 1;
export const RULESET_VERSION = '2026-09-default';

/** @typedef {'market'|'money'|'team'|'timing'|'implementation'|'personal-cost'} DecisionFaceId */
/** @typedef {'untested'|'tested'|'contradicted'|'unresolved'|'committed'} DecisionFaceState */
/** @typedef {'draft'|'in-progress'|'completed'|'published'|'archived'} DecisionStatus */
/** @typedef {'continue-testing'|'commit'|'pause'} DecisionDisposition */

/**
 * Fixed face order. Every consumer that iterates faces — the crystal, the map,
 * the legend, deriveNextTest — uses this order so output stays deterministic.
 * @type {readonly DecisionFaceId[]}
 */
export const FACE_IDS = Object.freeze([
  'market',
  'money',
  'team',
  'timing',
  'implementation',
  'personal-cost'
]);

/** @type {readonly DecisionFaceState[]} */
export const FACE_STATES = Object.freeze([
  'untested',
  'tested',
  'contradicted',
  'unresolved',
  'committed'
]);

/**
 * @typedef {'market:evidence-validated'|'market:evidence-signal'|'market:evidence-none'
 *   |'money:downside-contained'|'money:downside-material-funded'|'money:downside-material-unfunded'
 *   |'team:aligned'|'team:mixed'|'team:opposed'
 *   |'timing:external'|'timing:internal'|'timing:none'
 *   |'implementation:defined-reversible'|'implementation:defined-irreversible'|'implementation:undefined'
 *   |'personal:open'|'personal:committed'|'personal:confirmation'} DecisionSignal
 */

/** @type {readonly DecisionSignal[]} */
export const SIGNALS = Object.freeze([
  'market:evidence-validated',
  'market:evidence-signal',
  'market:evidence-none',
  'money:downside-contained',
  'money:downside-material-funded',
  'money:downside-material-unfunded',
  'team:aligned',
  'team:mixed',
  'team:opposed',
  'timing:external',
  'timing:internal',
  'timing:none',
  'implementation:defined-reversible',
  'implementation:defined-irreversible',
  'implementation:undefined',
  'personal:open',
  'personal:committed',
  'personal:confirmation'
]);

/**
 * @typedef {object} DecisionOption
 * @property {string} id
 * @property {string} label
 * @property {readonly DecisionSignal[]} signals
 */

/**
 * @typedef {object} DecisionQuestion
 * @property {string} id
 * @property {DecisionFaceId} faceId
 * @property {string} prompt
 * @property {boolean} required
 * @property {readonly DecisionOption[]} options
 */

/**
 * @typedef {object} DecisionAnswer
 * @property {string} questionId
 * @property {string} optionId
 * @property {string} answeredAt ISO-8601 UTC
 */

/**
 * @typedef {object} DecisionContradiction
 * @property {string} ruleId
 * @property {string} rulesetVersion
 * @property {DecisionFaceId} faceId
 * @property {'warning'|'break'} severity
 * @property {readonly string[]} evidenceOptionIds
 * @property {string} findingCode
 */

/**
 * @typedef {object} DecisionFinding
 * @property {string} code
 * @property {DecisionFaceId} faceId
 * @property {1|2|3} priority
 * @property {string} title
 * @property {string} body
 */

/**
 * @typedef {object} DecisionOutcome
 * @property {string} recordedAt ISO-8601 UTC
 * @property {'proceeded'|'paused'|'reversed'|'unknown'} result
 * @property {1|2|3|4|5} [confidence]
 */

/**
 * @typedef {object} DecisionPublication
 * @property {boolean} isPublic
 * @property {boolean} anonymized
 * @property {boolean} consentForAggregate
 * @property {readonly string[]} tags
 */

/**
 * @typedef {object} DecisionDerived
 * @property {string} rulesetVersion
 * @property {Record<DecisionFaceId, DecisionFaceState>} faceStates
 * @property {readonly DecisionContradiction[]} contradictions
 * @property {readonly DecisionFinding[]} findings
 */

/**
 * @typedef {object} Decision
 * @property {1} schemaVersion
 * @property {string} id opaque, never PII
 * @property {string} slug
 * @property {string} title
 * @property {string} category
 * @property {'low'|'medium'|'high'} stakes
 * @property {DecisionStatus} status
 * @property {DecisionDisposition} disposition
 * @property {string} createdAt ISO-8601 UTC
 * @property {string} updatedAt ISO-8601 UTC
 * @property {readonly DecisionQuestion[]} questions
 * @property {readonly DecisionAnswer[]} answers
 * @property {DecisionDerived} derived
 * @property {DecisionPublication} publication
 * @property {DecisionOutcome} [outcome]
 */

/**
 * Every face untested — the baseline a new check starts from.
 * @returns {Record<DecisionFaceId, DecisionFaceState>}
 */
export function untestedFaces() {
  /** @type {Record<string, DecisionFaceState>} */
  const faces = {};
  for (const id of FACE_IDS) faces[id] = 'untested';
  return /** @type {Record<DecisionFaceId, DecisionFaceState>} */ (faces);
}

/**
 * A new, empty check. `questions` is supplied by the check configuration so the
 * domain module stays free of copy.
 *
 * @param {object} init
 * @param {string} init.id
 * @param {readonly DecisionQuestion[]} init.questions
 * @param {string} [init.title]
 * @param {string} [init.category]
 * @param {'low'|'medium'|'high'} [init.stakes]
 * @param {string} [init.slug]
 * @param {string} [init.now] ISO-8601 UTC; injected so output stays deterministic
 * @returns {Decision}
 */
export function createDecision({
  id,
  questions,
  title = '',
  category = '',
  stakes = 'medium',
  slug = id,
  now = new Date().toISOString()
}) {
  return {
    schemaVersion: SCHEMA_VERSION,
    id,
    slug,
    title,
    category,
    stakes,
    status: 'draft',
    disposition: 'continue-testing',
    createdAt: now,
    updatedAt: now,
    questions,
    answers: [],
    derived: {
      rulesetVersion: RULESET_VERSION,
      faceStates: untestedFaces(),
      contradictions: [],
      findings: []
    },
    publication: {
      isPublic: false,
      anonymized: true,
      consentForAggregate: false,
      tags: []
    }
  };
}

/**
 * Replace-or-append one answer. A question carries at most one active answer,
 * so answering again replaces the record rather than appending a second one.
 *
 * @param {Decision} decision
 * @param {string} questionId
 * @param {string} optionId
 * @param {string} [now] ISO-8601 UTC
 * @returns {Decision} a new Decision; the input is not mutated
 */
export function withAnswer(decision, questionId, optionId, now = new Date().toISOString()) {
  const question = decision.questions.find((q) => q.id === questionId);
  if (!question) throw new Error(`unknown questionId: ${questionId}`);
  if (!question.options.some((o) => o.id === optionId)) {
    throw new Error(`option ${optionId} does not belong to ${questionId}`);
  }
  const answers = decision.answers.filter((a) => a.questionId !== questionId);
  answers.push({ questionId, optionId, answeredAt: now });
  answers.sort((a, b) => indexOfQuestion(decision, a.questionId) - indexOfQuestion(decision, b.questionId));
  return { ...decision, answers, updatedAt: now };
}

/**
 * Drop answers that point at options the current configuration no longer has.
 * The `invalid` wizard state is defined in terms of this.
 *
 * @param {Decision} decision
 * @returns {{decision: Decision, dropped: readonly string[]}}
 */
export function pruneInvalidAnswers(decision) {
  const dropped = [];
  const answers = decision.answers.filter((answer) => {
    const question = decision.questions.find((q) => q.id === answer.questionId);
    const ok = Boolean(question && question.options.some((o) => o.id === answer.optionId));
    if (!ok) dropped.push(answer.questionId);
    return ok;
  });
  if (!dropped.length) return { decision, dropped };
  return { decision: { ...decision, answers }, dropped };
}

/**
 * @param {Decision} decision
 * @returns {readonly string[]} selected option ids, in question order
 */
export function selectedOptionIds(decision) {
  return decision.questions
    .map((q) => decision.answers.find((a) => a.questionId === q.id))
    .filter(Boolean)
    .map((a) => /** @type {DecisionAnswer} */ (a).optionId);
}

/**
 * @param {Decision} decision
 * @returns {boolean} true when every required question holds a valid answer
 */
export function isComplete(decision) {
  return decision.questions
    .filter((q) => q.required)
    .every((q) => decision.answers.some((a) => a.questionId === q.id));
}

/**
 * Structural check. Deliberately narrow: it guards the domain invariants the
 * specification names, not the copy.
 *
 * @param {unknown} value
 * @returns {readonly string[]} problems; empty means valid
 */
export function validateDecision(value) {
  const problems = [];
  const d = /** @type {Decision} */ (value);
  if (!d || typeof d !== 'object') return ['decision is not an object'];
  if (d.schemaVersion !== SCHEMA_VERSION) problems.push('schemaVersion must be 1');
  if (!d.id) problems.push('id is required');
  for (const field of ['email', 'name', 'phone', 'crmId', 'ip', 'schedulingId']) {
    if (field in d) problems.push(`${field} must not be a field on Decision`);
  }
  if (!d.derived || d.derived.rulesetVersion == null) problems.push('derived.rulesetVersion is required');
  if (d.derived) {
    for (const id of FACE_IDS) {
      const state = d.derived.faceStates && d.derived.faceStates[id];
      if (!FACE_STATES.includes(state)) problems.push(`derived.faceStates.${id} is not a face state`);
    }
  }
  const seen = new Set();
  for (const answer of d.answers || []) {
    if (seen.has(answer.questionId)) problems.push(`duplicate answer for ${answer.questionId}`);
    seen.add(answer.questionId);
  }
  return problems;
}

/**
 * The persistence boundary. This site keeps unfinished checks in the browser
 * only (OD-02), so the adapter is an identity pass with validation; a real
 * backend replaces the two bodies without touching any caller.
 *
 * @type {{fromPersisted(input: unknown): Decision, toPersisted(decision: Decision): unknown}}
 */
export const decisionAdapter = {
  fromPersisted(input) {
    const problems = validateDecision(input);
    if (problems.length) throw new Error(`invalid persisted decision: ${problems.join('; ')}`);
    return /** @type {Decision} */ (input);
  },
  toPersisted(decision) {
    return decision;
  }
};

/**
 * @param {Decision} decision
 * @param {string} questionId
 * @returns {number}
 */
function indexOfQuestion(decision, questionId) {
  return decision.questions.findIndex((q) => q.id === questionId);
}
